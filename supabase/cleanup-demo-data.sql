begin;

delete from public.notifications;
delete from public.report_logs;
delete from public.checklists;

delete from public.whitelist_users
where email not in (
  'testnguyen079@gmail.com',
  'mytrang4000@gmail.com',
  'phat.nguyen@enosta.com',
  'a.not@team.enosta.com',
  'trangmy.nguyen@team.enosta.com',
  'dungvan.tran@team.enosta.com',
  'chinh.nguyen@team.enosta.com',
  'longhoang.nguyen@team.enosta.com',
  'viet.truong@team.enosta.com',
  'thang.nguyen@team.enosta.com',
  'dat.le@team.enosta.com',
  'thien.pham@enosta.com',
  'lan.tran@team.enosta.com',
  'tri.nguyen@team.enosta.com',
  'quy.do@team.enosta.com',
  'huy.nguyenphuoc@team.enosta.com',
  'linh.van@team.enosta.com',
  'trung.bui@team.enosta.com',
  'van.tran@team.enosta.com',
  'luc.le@team.enosta.com',
  'vungoclinh.nguyen@team.enosta.com'
);

insert into public.whitelist_users (email, name, role, status)
values
  ('testnguyen079@gmail.com', 'My Trang Nguyen', 'Member', 'Active'),
  ('mytrang4000@gmail.com', 'Trang Nguyen', 'Leader', 'Active'),
  ('phat.nguyen@enosta.com', 'Phat Nguyen', 'Leader', 'Active'),
  ('a.not@team.enosta.com', 'A Nớt', 'Member', 'Active'),
  ('trangmy.nguyen@team.enosta.com', 'Nguyễn Thị Mỹ Trang', 'Member', 'Active'),
  ('dungvan.tran@team.enosta.com', 'Trần Văn Dũng', 'Member', 'Active'),
  ('chinh.nguyen@team.enosta.com', 'Nguyễn Khắc Chính', 'Member', 'Active'),
  ('longhoang.nguyen@team.enosta.com', 'Nguyễn Hữu Hoàng Long', 'Member', 'Active'),
  ('viet.truong@team.enosta.com', 'Trương Đức Việt', 'Member', 'Active'),
  ('thang.nguyen@team.enosta.com', 'Nguyễn Xuân Thắng', 'Member', 'Active'),
  ('dat.le@team.enosta.com', 'Lê Tiến Đạt', 'Member', 'Active'),
  ('thien.pham@enosta.com', 'Phạm Anh Thiện', 'Member', 'Active'),
  ('lan.tran@team.enosta.com', 'Trần Hoàng Lan', 'Member', 'Active'),
  ('tri.nguyen@team.enosta.com', 'Nguyễn Văn Trí', 'Member', 'Active'),
  ('quy.do@team.enosta.com', 'Đỗ Ngọc Quý', 'Member', 'Active'),
  ('huy.nguyenphuoc@team.enosta.com', 'Nguyễn Phước Huy', 'Member', 'Active'),
  ('linh.van@team.enosta.com', 'Văn Bá Linh', 'Member', 'Active'),
  ('trung.bui@team.enosta.com', 'Bùi Đình Trung', 'Member', 'Active'),
  ('van.tran@team.enosta.com', 'Trần Công Văn', 'Member', 'Active'),
  ('luc.le@team.enosta.com', 'Lê Trung Lực', 'Member', 'Active'),
  ('vungoclinh.nguyen@team.enosta.com', 'Nguyễn Vũ Ngọc Linh', 'Member', 'Active')
on conflict (email)
do update set
  name = excluded.name,
  role = excluded.role,
  status = excluded.status,
  updated_at = now();

commit;
