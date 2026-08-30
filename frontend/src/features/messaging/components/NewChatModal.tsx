import React, { useState } from "react";
import { Search, User, Shield, Briefcase, Mail } from "lucide-react";
import { ModalShell, Avatar, Badge, inputCls } from "../../../components/ui";
import type { AuthUser } from "../../../types";

export interface ContactUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  companyName?: string;
  department?: string;
  designation?: string;
  avatar?: string;
}

interface NewChatModalProps {
  contacts: ContactUser[];
  currentUser: AuthUser;
  onClose: () => void;
  onSelectContact: (contact: ContactUser) => void;
}

export function NewChatModal({
  contacts,
  currentUser,
  onClose,
  onSelectContact,
}: NewChatModalProps) {
  const [search, setSearch] = useState("");

  // Filter out self and search match
  const filteredContacts = contacts.filter((c) => {
    if (c.email.toLowerCase() === currentUser.email.toLowerCase()) return false;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.role.toLowerCase().includes(q) ||
      (c.companyName && c.companyName.toLowerCase().includes(q)) ||
      (c.department && c.department.toLowerCase().includes(q))
    );
  });

  const getRoleBadgeTone = (role: string) => {
    switch (role) {
      case "SuperAdmin":
        return "purple";
      case "HRAdmin":
        return "blue";
      case "CompanyOwner":
        return "emerald";
      case "Manager":
        return "amber";
      case "Accountant":
        return "green";
      case "Viewer":
        return "purple";
      default:
        return "blue";
    }
  };

  return (
    <ModalShell title="Start New Conversation" onClose={onClose}>
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, role, company or email..."
            className={inputCls + " pl-9"}
          />
        </div>

        {/* Contact List */}
        <div className="max-h-[340px] overflow-y-auto divide-y divide-border/60 rounded-lg border border-border/80 bg-card">
          {filteredContacts.map((c) => (
            <div
              key={c.email}
              onClick={() => {
                onSelectContact(c);
                onClose();
              }}
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar initials={c.avatar || c.name.slice(0, 2).toUpperCase()} />
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate flex items-center gap-2">
                    {c.name}
                    {c.companyName && (
                      <span className="text-[11px] font-normal text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                        {c.companyName}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {c.email}
                  </div>
                  {c.designation && (
                    <div className="text-[11px] text-muted-foreground/80 truncate">
                      {c.designation} {c.department ? `• ${c.department}` : ""}
                    </div>
                  )}
                </div>
              </div>

              <Badge tone={getRoleBadgeTone(c.role)}>
                {c.role === "Viewer" ? "HR Staff / Viewer" : c.role}
              </Badge>
            </div>
          ))}

          {filteredContacts.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No contacts found matching "{search}"
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
