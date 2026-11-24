import{currentUser}from"@/lib/auth";import{redirect}from"next/navigation";import Workspace from"@/components/workspace-module";
export default async function ModulePage({params}:{params:Promise<{module:string}>}){const u=await currentUser();if(!u)redirect("/");const {module}=await params;return <Workspace module={module} role={u.role} name={u.name}/>}
