-- Public read + admin write policies for the products and categories storage buckets

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public read products/categories') THEN
    CREATE POLICY "Public read products/categories"
      ON storage.objects FOR SELECT
      USING (bucket_id IN ('products','categories'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admin insert products/categories') THEN
    CREATE POLICY "Admin insert products/categories"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id IN ('products','categories') AND public.has_role(auth.uid(), 'super_admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admin update products/categories') THEN
    CREATE POLICY "Admin update products/categories"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id IN ('products','categories') AND public.has_role(auth.uid(), 'super_admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admin delete products/categories') THEN
    CREATE POLICY "Admin delete products/categories"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id IN ('products','categories') AND public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;