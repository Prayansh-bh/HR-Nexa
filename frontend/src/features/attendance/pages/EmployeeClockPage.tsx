import React from "react";
import { EmployeeClockPage as LegacyEmployeeClockPage } from "../../employees/pages/EmployeeClockPage";

export const EmployeeClockPage: React.FC<any> = (props) => {
  return <LegacyEmployeeClockPage {...props} />;
};
