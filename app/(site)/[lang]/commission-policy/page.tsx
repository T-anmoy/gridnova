import { policyRoute } from "@/components/legal/policyPage";

const route = policyRoute("commission-policy");
export const generateMetadata = route.generateMetadata;
export default route.Page;
