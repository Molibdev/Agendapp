-- Solo lectura. Ejecutar tras las tres migraciones en el SQL Editor del proyecto.
-- No muestra datos personales ni modifica usuarios, políticas o tablas.
begin read only;

-- Todas las filas deben indicar exists=true y rls_enabled=true.
with expected(name) as (
 values ('profiles'),('accounts'),('categories'),('transactions'),('transfers'),
        ('budgets'),('savings_goals'),('goal_contributions'),('finance_snapshots')
)
select e.name, c.oid is not null as exists, coalesce(c.relrowsecurity,false) as rls_enabled
from expected e
left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=e.name and c.relkind='r'
order by e.name;

-- Verificar que owner_snapshots exige auth.uid() en lectura y escritura.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='finance_snapshots';

-- Debe existir el trigger snapshot_revision, habilitado (O).
select t.tgname, t.tgenabled
from pg_trigger t
where t.tgrelid=to_regclass('public.finance_snapshots') and not t.tgisinternal;

-- Las tres filas deben mostrar allowed=true; anon_access debe ser false.
select privilege,
 case when to_regclass('public.finance_snapshots') is null then false
 else has_table_privilege('authenticated',to_regclass('public.finance_snapshots'),privilege) end as allowed,
 case when to_regclass('public.finance_snapshots') is null then false
 else has_table_privilege('anon',to_regclass('public.finance_snapshots'),privilege) end as anon_access
from (values ('SELECT'),('INSERT'),('UPDATE')) as privileges(privilege);

-- Estas cinco columnas confirman la tercera migración.
select column_name from information_schema.columns
where table_schema='public' and table_name='accounts'
 and column_name in ('bank','bank_type','maintenance_fee','credit_limit','billing_day')
order by column_name;
commit;
