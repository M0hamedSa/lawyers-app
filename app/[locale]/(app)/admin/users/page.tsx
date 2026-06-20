import type { Metadata } from "next";
import { getAllUsers, getAdminClients, getCurrentUser } from "@/lib/supabase/queries";
import { UsersManagement } from "@/components/admin/users-management";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tAdmin = await getTranslations({ locale, namespace: "Admin" });
  return { title: tAdmin("manageUsers") };
}
export default async function AdminUsersPage({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  const { locale } = await params;
  const currentUser = await getCurrentUser();
  const role = currentUser?.role;
  
  if (role !== "superadmin") {
    redirect({ href: "/dashboard", locale: locale as "en" | "ar" });
  }

  const [users, clients] = await Promise.all([
    getAllUsers(),
    getAdminClients()
  ]);
  
  const nonSuperAdminUsers = users.filter(u => u.role !== "superadmin");
  
  const tAdmin = await getTranslations("Admin");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-caption-uppercase uppercase text-accent-700">{tAdmin("title")}</p>
        <h1 className="mt-1 text-display-md text-ink-800">{tAdmin("manageUsers")}</h1>
      </div>

      <UsersManagement 
        initialUsers={nonSuperAdminUsers} 
        allClients={clients} 
        currentRole={role || null} 
        currentUserId={currentUser?.id || ""} 
      />
    </div>
  );
}
