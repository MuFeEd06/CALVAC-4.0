export interface ProductColor {
  hex: string;
  name: string;
  price?: number;
  image?: string;
}

export interface Product {
  id: number;
  name: string;
  brand: string;
  price: number;
  original_price?: number;
  image: string;
  tag?: string;
  category?: string;
  sizes: string[];
  colors: ProductColor[];
  stock?: Record<string, number>;
  specs?: string;
  total_stock?: number;
  out_of_stock?: boolean;
}

export interface CartItem {
  id: number;
  name: string;
  brand: string;
  price: number;
  image: string;
  size: string;
  color?: string;
  colorHex?: string;
  qty: number;
}

export interface Address {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pin: string;
  landmark?: string;
}

export interface SiteSettings {
  primary_color: string;
  hero_font: string;
  model_path: string;
  model_scale: number;
  model_y: number;
  model_speed: number;
  size_unit: 'uk' | 'euro';
  show_new_arrivals: boolean;
  show_categories: boolean;
  cat_boots: boolean;
  cat_crocs: boolean;
  cat_girls: boolean;
  cat_sale: boolean;
  cat_under1000: boolean;
  cat_under1500: boolean;
  cat_under2500: boolean;
  cat_new: boolean;
  cat_premium: boolean;
  cat_all: boolean;
  hero_eyebrow?: string;
  hero_headline?: string;
  hero_highlight?: string;
  hero_headline2?: string;
  hero_sub?: string;
  hero_prompt_text?: string;
  hero_text_color?: string;
  hero_sub_color?: string;
  hero_overlay_color?: string;
  hero_intro_font_size_rem?: number;
  hero_intro_max_width_px?: number;
  hero_intro_y_offset_px?: number;
  hero_intro_fade_start?: number;
  hero_intro_fade_end?: number;
  hero_overlay_fade_in_start?: number;
  hero_overlay_fade_in_end?: number;
  hero_overlay_fade_out_start?: number;
  hero_overlay_fade_out_end?: number;
  hero_overlay_left_label?: string;
  hero_overlay_left_title?: string;
  hero_overlay_right_label?: string;
  hero_overlay_right_title?: string;
  hero_overlay_left_x?: number;
  hero_overlay_left_y?: number;
  hero_overlay_right_x?: number;
  hero_overlay_right_y?: number;
  hero_image_scale?: number;
  hero_scroll_height_vh?: number;
  hero_gradient_strength?: number;
  hero_intro_align?: 'left' | 'center' | 'right';
  hero_intro_x_pct?: number;
  hero_intro_y_pct?: number;
  hero_prompt_x_pct?: number;
  hero_prompt_y_px?: number;
  hero_eyebrow_size_px?: number;
  hero_sub_size_rem?: number;
  hero_prompt_size_px?: number;
  hero_eyebrow_visible?: boolean;
  hero_headline_visible?: boolean;
  hero_sub_visible?: boolean;
  hero_prompt_visible?: boolean;
  hero_overlay_left_visible?: boolean;
  hero_overlay_right_visible?: boolean;
  hero_intro_visible?: boolean;
  hero_image_visible?: boolean;
  hero_gradient_visible?: boolean;
}

export interface Offer {
  active: boolean;
  text: string;
  bg_color: string;
  text_color: string;
  show_logo?: boolean;
}

export interface BrandConfig {
  name: string;
  slug: string;
  color: string;
  logo: string;
}
