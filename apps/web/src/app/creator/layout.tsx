import RequireAuth from "@/components/RequireAuth";

// One guard for every page in this section: waits for the real session check, then redirects anonymous visitors to login.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
