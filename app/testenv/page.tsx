export default function TestEnv() {
  return <div>{process.env.NEXT_PUBLIC_SUPABASE_URL}</div>;
}
