import { policyRoute } from "@/components/legal/policyPage";

const route = policyRoute("privacy");
export const generateMetadata = route.generateMetadata;
export default route.Page;
