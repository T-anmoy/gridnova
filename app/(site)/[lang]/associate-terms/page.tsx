import { policyRoute } from "@/components/legal/policyPage";

const route = policyRoute("associate-terms");
export const generateMetadata = route.generateMetadata;
export default route.Page;
