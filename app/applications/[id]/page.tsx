import{currentUser}from"@/lib/auth";import{redirect}from"next/navigation";import Detail from"@/components/application-detail-client";
export default async function DetailPage({params}:{params:Promise<{id:string}>}){const u=await currentUser();if(!u)redirect("/");const {id}=await params;return <Detail id={id} role={u.role} name={u.name}/>}
