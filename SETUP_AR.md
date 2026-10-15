# ربط صفحة البروفايل بلوحة التعديل (GitHub Pages + Supabase)

الصفحة العامة هي `index.html`، ولوحة الإدارة هي `admin.html`. الموقعين الصغيرين داخل المشروع بيتصلوا بنفس قاعدة بيانات Supabase؛ لذلك لما تعمل Publish من لوحة الإدارة، الصفحة العامة بتقرأ التعديلات الجديدة عند فتحها أو تحديثها، من غير ما تحتاج تعدّل HTML كل مرة.

> **مهم بخصوص الخصوصية:** GitHub Pages استضافة static؛ لو `admin.html` موجودة في نفس الـ repository المنشور، ملف الصفحة نفسه ومصدر HTML/JavaScript هيكونوا قابلين للتحميل. لوحة الإدارة هنا بتطلب تسجيل دخول، وصلاحيات Supabase هي اللي تمنع الحسابات الأخرى من تعديل بيانات البروفايل أو رفع صور. لو عايز حتى رابط الإدارة نفسه مايفتحش لغيرك، لازم تحمي المسار على خدمة فيها Access Control مثل Cloudflare Access أو تستضيف لوحة الإدارة على خدمة خاصة منفصلة.

## 1) أنشئ مشروع Supabase

1. أنشئ مشروعًا جديدًا من [supabase.com](https://supabase.com/).
2. من إعدادات المشروع انسخ **Project URL** و**anon/public key** (أو الـ publishable key لو لوحة المشروع بتعرضه بالاسم ده).
3. من **Authentication → Users** أضف حسابًا لك أنت بكلمة مرور قوية، وتأكد أن البريد مطابق للبريد الذي ستضعه في الإعدادات.
4. من إعدادات Authentication عطّل التسجيل العام (Allow new users to sign up / Enable signups) إذا كان هذا الخيار ظاهرًا؛ أنت أنشئ حساب المالك بنفسك من لوحة Supabase.

## 2) أضف إعدادات المشروع

افتح `javascript/supabase-config.js` وغيّر القيم الثلاث فقط:

```js
window.PROFILE_SUPABASE_CONFIG = {
  url: "https://YOUR-PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
  adminEmail: "YOUR-ADMIN-EMAIL@example.com"
};
```

- `url`: Project URL الحقيقي.
- `anonKey`: المفتاح العام anon/publishable فقط.
- `adminEmail`: نفس بريد حساب المالك في Supabase.

**ممنوع تمامًا** وضع `service_role` أو أي secret key داخل ملفات GitHub؛ هذه المفاتيح تعطي صلاحيات واسعة. المفتاح العام وحده لا يكفي لتعديل البيانات لأن سياسات قاعدة البيانات التالية تفرض صلاحية المالك.

## 3) أنشئ الجدول والصلاحيات

في Supabase افتح **SQL Editor → New query**، استبدل `YOUR-ADMIN-EMAIL@example.com` في كل مكان ببريدك الحقيقي، ثم شغّل الاستعلام التالي مرة واحدة:

```sql
create table if not exists public.profile_content (
  id integer primary key check (id = 1),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profile_content enable row level security;

drop policy if exists "Public can read profile" on public.profile_content;
create policy "Public can read profile"
on public.profile_content for select
using (true);

drop policy if exists "Owner can insert profile" on public.profile_content;
create policy "Owner can insert profile"
on public.profile_content for insert to authenticated
with check ((auth.jwt() ->> 'email') = 'YOUR-ADMIN-EMAIL@example.com');

drop policy if exists "Owner can update profile" on public.profile_content;
create policy "Owner can update profile"
on public.profile_content for update to authenticated
using ((auth.jwt() ->> 'email') = 'YOUR-ADMIN-EMAIL@example.com')
with check ((auth.jwt() ->> 'email') = 'YOUR-ADMIN-EMAIL@example.com');

-- Explicit least-privilege table grants: visitors can only read; the signed-in owner can read/insert/update.
revoke all on table public.profile_content from anon, authenticated;
grant select on table public.profile_content to anon, authenticated;
grant insert, update on table public.profile_content to authenticated;

-- Create a public-read bucket for the profile image. Uploads still require owner authentication.
insert into storage.buckets (id, name, public)
values ('profile-assets', 'profile-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view profile assets" on storage.objects;
create policy "Public can view profile assets"
on storage.objects for select to public
using (bucket_id = 'profile-assets');

drop policy if exists "Owner can upload profile assets" on storage.objects;
create policy "Owner can upload profile assets"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-assets'
  and (auth.jwt() ->> 'email') = 'YOUR-ADMIN-EMAIL@example.com'
);

drop policy if exists "Owner can update profile assets" on storage.objects;
create policy "Owner can update profile assets"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-assets'
  and (auth.jwt() ->> 'email') = 'YOUR-ADMIN-EMAIL@example.com'
)
with check (
  bucket_id = 'profile-assets'
  and (auth.jwt() ->> 'email') = 'YOUR-ADMIN-EMAIL@example.com'
);

drop policy if exists "Owner can delete profile assets" on storage.objects;
create policy "Owner can delete profile assets"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-assets'
  and (auth.jwt() ->> 'email') = 'YOUR-ADMIN-EMAIL@example.com'
);
```

## 4) ارفع المشروع إلى GitHub

احتفظ بنفس ترتيب الملفات، ثم ارفع **كل محتويات مجلد `my profile page`** إلى جذر الـ repository، بحيث تكون الملفات بهذا الشكل:

```text
MyProfile/
├── index.html
├── admin.html
├── SETUP_AR.md
├── images/
├── styles/
│   ├── styles.css
│   └── admin.css
└── javascript/
    ├── script.js
    ├── supabase-config.js
    ├── profile-defaults.js
    ├── profile-sync.js
    └── admin.js
```

في GitHub افتح **Settings → Pages** واختر الفرع والمجلد الذي يحتوي على `index.html` (غالبًا `main` و`/ (root)`). بعد النشر:

- صفحة الزوار: `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`
- لوحة الإدارة: `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/admin.html`

## 5) أول مرة تعدّل فيها

1. افتح رابط `admin.html` وسجّل الدخول ببريد المالك وكلمة المرور التي أنشأتها في Supabase.
2. الصورة والروابط الحالية هتظهر كبيانات بداية. عدّلها، أو أضف واحذف روابط من الأزرار المخصصة لذلك.
3. اضغط **Publish changes**. ده بيحفظ المحتوى في جدول `profile_content` ويرفع الصورة إلى `profile-assets` عند اختيار صورة جديدة.
4. افتح الصفحة العامة أو اعمل Refresh. المفروض تظهر التغييرات تلقائيًا.

لو لوحة الإدارة لا تعمل، راجع: صحة القيم في `supabase-config.js`، وسياسات SQL، وأن بريد حساب الدخول يطابق `adminEmail` حرفيًا. لا تضع كلمة المرور في الملفات أو في GitHub.

## ملاحظات عن الأيقونات والروابط

- روابط الإنترنت استخدم معها `https://`، والبريد `mailto:you@example.com`، ورقم الهاتف `tel:+20...`.
- خانة Icon class تقبل أسماء أيقونات Font Awesome أو Bootstrap Icons المستخدمة بالموقع؛ أمثلة: `fab fa-instagram` و`bi bi-link-45deg` و`fa fa-link`.
- إذا لم تضبط Supabase بعد، ستظل الصفحة العامة تعمل بالمحتوى الأصلي كـ fallback، ولوحة الإدارة ستوضح أنها تحتاج إعدادًا.
