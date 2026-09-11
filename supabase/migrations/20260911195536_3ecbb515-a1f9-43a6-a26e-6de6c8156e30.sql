alter table public.user_ai_preferences alter column default_model set default 'google/gemini-3.6-flash';
update public.user_ai_preferences set default_model = case default_model
  when 'google/gemini-2.5-flash' then 'google/gemini-3.6-flash'
  when 'google/gemini-2.5-flash-lite' then 'google/gemini-3.1-flash-lite'
  when 'google/gemini-2.5-pro' then 'google/gemini-3.1-pro-preview'
  else default_model end
where default_model like 'google/gemini-2.5%';