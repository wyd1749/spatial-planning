import {currentUser} from "@/lib/auth";import {redirect} from "next/navigation";import NewApplication from "@/components/new-application-client";
export default async function NewApplicationPage(){const user=await currentUser();if(!user)redirect("/");if(user.role==="Senior officer")redirect("/applications");return <NewApplication role={user.role} name={user.name}/>}
