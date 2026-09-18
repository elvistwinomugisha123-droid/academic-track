revoke execute on function public.confirm_classroom_outcome(uuid, text, text, text) from anon;
revoke execute on function public.correct_classroom_outcome(uuid, uuid, text, text, text) from anon;

grant execute on function public.confirm_classroom_outcome(uuid, text, text, text) to authenticated;
grant execute on function public.correct_classroom_outcome(uuid, uuid, text, text, text) to authenticated;
