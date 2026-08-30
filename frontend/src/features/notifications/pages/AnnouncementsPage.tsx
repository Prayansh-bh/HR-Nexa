import React from "react";
import { AnnouncementsPage as LegacyAnnouncementsPage } from "../../announcements/pages/AnnouncementsPage";
import { useAnnouncementsQuery } from "../../../hooks/useDashboardQueries";

export const AnnouncementsPage: React.FC<any> = (props) => {
  const { data: broadcastsData } = useAnnouncementsQuery();
  const broadcasts = broadcastsData || [];
  return <LegacyAnnouncementsPage {...props} broadcasts={broadcasts} setBroadcasts={() => {}} />;
};
