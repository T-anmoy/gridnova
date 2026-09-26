import { policyRoute } from "@/components/legal/policyPage";

const route = policyRoute("payment-policy");
export const generateMetadata = route.generateMetadata;
export default route.Page;
