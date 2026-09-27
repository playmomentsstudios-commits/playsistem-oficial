alter table public.courses
  add column if not exists category text;

comment on column public.courses.category is 'Categoria exibida no card da Academia, por exemplo Design Gráfico, Marketing ou Tecnologia.';
