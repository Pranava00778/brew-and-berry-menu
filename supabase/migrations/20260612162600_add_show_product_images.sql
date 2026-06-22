-- ADD COLUMN show_product_images TO landing_settings
ALTER TABLE public.landing_settings ADD COLUMN show_product_images boolean NOT NULL DEFAULT true;
