
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','leader','operator');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  employee_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','leader'))
$$;

CREATE POLICY "user_roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- new user -> profile + default operator role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role,'operator'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- MACHINES
CREATE TABLE public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  workshop text NOT NULL DEFAULT 'MC',
  status text NOT NULL DEFAULT 'WAIT',
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT ALL ON public.machines TO service_role;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "machines_select" ON public.machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "machines_update" ON public.machines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "machines_insert_mgr" ON public.machines FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY "machines_delete_admin" ON public.machines FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.machine_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.machine_status_log TO authenticated;
GRANT ALL ON public.machine_status_log TO service_role;
ALTER TABLE public.machine_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msl_select" ON public.machine_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "msl_insert" ON public.machine_status_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- WORK ORDERS
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number text NOT NULL UNIQUE,
  customer text,
  part_number text NOT NULL,
  part_name text,
  drawing_number text,
  quantity int NOT NULL DEFAULT 0,
  priority int NOT NULL DEFAULT 3,
  due_date date,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  operation text,
  status text NOT NULL DEFAULT 'PLANNED',
  remark text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wo_select" ON public.work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "wo_write_mgr" ON public.work_orders FOR ALL TO authenticated
  USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));

-- JOBS
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  plan_start timestamptz,
  plan_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  status text NOT NULL DEFAULT 'PLANNED',
  good_qty int NOT NULL DEFAULT 0,
  ng_qty int NOT NULL DEFAULT 0,
  remark text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_select" ON public.jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "jobs_write_mgr" ON public.jobs FOR ALL TO authenticated
  USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY "jobs_update_own" ON public.jobs FOR UPDATE TO authenticated
  USING (operator_id = auth.uid()) WITH CHECK (operator_id = auth.uid());

-- AUDIT LOG
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_insert_self" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "audit_select_mgr" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));

-- SEED MACHINES
INSERT INTO public.machines (code, name, workshop, status, sort_order) VALUES
 ('MC-01','MAZAK VCN-410','MC','RUN',1),
 ('MC-02','MAZAK VCN-530','MC','RUN',2),
 ('MC-03','BROTHER S700X1','MC','WAIT',3),
 ('MC-04','OKUMA GENOS M560','MC','SETUP',4),
 ('MC-05','MORI SEIKI NVX5080','MC','RUN',5),
 ('LT-01','MAZAK QTN-200','LATHE','BREAKDOWN',6),
 ('LT-02','OKUMA LB3000','LATHE','RUN',7),
 ('GR-01','OKAMOTO PSG-52','GRIND','MAINTENANCE',8);

-- SEED WORK ORDERS + JOBS
INSERT INTO public.work_orders (wo_number, customer, part_number, part_name, drawing_number, quantity, priority, due_date, machine_id, operation, status)
SELECT v.wo, v.cus, v.pn, v.pname, v.dwg, v.qty, v.pri, v.due::date, m.id, v.op, v.st
FROM (VALUES
 ('WO-2601-001','DENSO','P-1001','BRACKET A','DWG-1001',200,1,CURRENT_DATE + 2,'MC-01','MILLING','IN_PROGRESS'),
 ('WO-2601-002','KYOCERA','P-1002','SHAFT B','DWG-1002',120,2,CURRENT_DATE + 3,'MC-02','MILLING','IN_PROGRESS'),
 ('WO-2601-003','NIDEC','P-1003','HOUSING C','DWG-1003',80,1,CURRENT_DATE + 1,'MC-03','MILLING','PLANNED'),
 ('WO-2601-004','DENSO','P-1004','PLATE D','DWG-1004',300,3,CURRENT_DATE + 5,'MC-05','MILLING','PLANNED'),
 ('WO-2601-005','THK','P-1005','PIN E','DWG-1005',500,2,CURRENT_DATE + 4,'LT-02','TURNING','IN_PROGRESS'),
 ('WO-2601-006','SMC','P-1006','RING F','DWG-1006',150,3,CURRENT_DATE + 6,'MC-04','MILLING','PLANNED')
) AS v(wo,cus,pn,pname,dwg,qty,pri,due,mcode,op,st)
JOIN public.machines m ON m.code = v.mcode;

INSERT INTO public.jobs (work_order_id, machine_id, plan_start, plan_end, actual_start, actual_end, status, good_qty, ng_qty)
SELECT w.id, w.machine_id,
  date_trunc('day', now()) + (v.ps || ' hours')::interval,
  date_trunc('day', now()) + (v.pe || ' hours')::interval,
  CASE WHEN v.act THEN date_trunc('day', now()) + ((v.ps + 0.5) || ' hours')::interval END,
  CASE WHEN v.done THEN date_trunc('day', now()) + ((v.pe - 0.5) || ' hours')::interval END,
  v.st, v.good, v.ng
FROM (VALUES
 ('WO-2601-001', 8, 14, true, true, 'COMPLETED', 190, 5),
 ('WO-2601-002', 9, 17, true, false, 'RUNNING', 60, 2),
 ('WO-2601-003', 13, 18, false, false, 'PLANNED', 0, 0),
 ('WO-2601-004', 8, 20, false, false, 'PLANNED', 0, 0),
 ('WO-2601-005', 7, 16, true, false, 'RUNNING', 220, 8),
 ('WO-2601-006', 10, 15, false, false, 'PLANNED', 0, 0)
) AS v(wo, ps, pe, act, done, st, good, ng)
JOIN public.work_orders w ON w.wo_number = v.wo;
