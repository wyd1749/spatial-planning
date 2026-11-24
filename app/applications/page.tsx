import {currentUser} from "@/lib/auth";import{redirect}from"next/navigation";import ApplicationsClient from"@/components/applications-client";
export default async function ApplicationsPage(){const user=await currentUser();if(!user)redirect("/");return <ApplicationsClient role={user.role} name={user.name}/>}
