import React from "react";
import { BulkOnboardingWizard as LegacyBulkOnboardingWizard } from "../components/BulkOnboardingWizard";

export const BulkOnboardingWizardPage: React.FC<any> = (props) => {
  return <LegacyBulkOnboardingWizard {...props} />;
};
