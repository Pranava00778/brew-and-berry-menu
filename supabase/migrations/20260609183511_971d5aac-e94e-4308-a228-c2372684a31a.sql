
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public read menu-images') THEN
    CREATE POLICY "Public read menu-images" ON storage.objects FOR SELECT USING (bucket_id = 'menu-images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admin insert menu-images') THEN
    CREATE POLICY "Admin insert menu-images" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admin update menu-images') THEN
    CREATE POLICY "Admin update menu-images" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'super_admin'::public.app_role))
      WITH CHECK (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admin delete menu-images') THEN
    CREATE POLICY "Admin delete menu-images" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;
