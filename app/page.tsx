import SignInScreen from "@/components/sign-in-screen";import{currentUser}from"@/lib/auth";import{redirect}from"next/navigation";
export default async function Page(){const user=await currentUser();if(user)redirect(user.role==="Senior officer"?"/senior-dashboard":user.role==="Management"?"/management-dashboard":"/planning-dashboard");return <SignInScreen/>}
