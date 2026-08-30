import { useState, useMemo, useEffect } from "react";
import { User, Shield, Mail, ShieldAlert, Upload, RotateCw, Trash2, Save, Loader2, Info, Laptop } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthProfileQuery, AUTH_PROFILE_QUERY_KEY } from "../../../hooks/useAuthProfileQuery";
import { useEmployeeAssetsQuery } from "../../../hooks/useAssetsQuery";
import { employeeService } from "../../../services/employee.service";
import { isImageSource, resolveAvatarUrl, extractInitials } from "../../../utils/avatar";
import type { Employee } from "../../../types";

const cardCls =
  "rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";
const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 text-foreground";
const labelCls = "text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1";

function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger" | "success";
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "btn-gradient hover:brightness-110 text-white",
    success: "bg-[color:var(--color-success)] text-white shadow-md hover:brightness-110",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    outline: "border border-border bg-card hover:border-primary hover:text-primary text-foreground",
    danger: "bg-destructive text-destructive-foreground shadow-md hover:brightness-110",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col">
      <label className={labelCls}>{label}</label>
      {children}
      {error && <span className="text-xs text-destructive mt-1">{error}</span>}
    </div>
  );
}

export function ProfilePage({
  user,
  setUser,
  toast,
}: {
  user: any;
  setUser: (u: any) => void;
  toast: (m: string, tone?: "success" | "error" | "info") => void;
}) {
  const queryClient = useQueryClient();
  const { data: authProfile, isLoading } = useAuthProfileQuery();

  const [activeTab, setActiveTab] = useState<"personal" | "id" | "contact" | "emergency" | "assets">(
    "personal",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const empIdForAssets = authProfile?.employee?.id;
  const { data: myAssets = [], isLoading: isLoadingMyAssets } = useEmployeeAssetsQuery(empIdForAssets);

  const initialProfile = useMemo((): Employee => {
    const emp = authProfile?.employee;
    if (emp) {
      const rawAvatar = emp.photoData || emp.avatar || "";
      return {
        id: emp.id,
        name: emp.name || authProfile?.name || user?.name || "",
        email: emp.email || authProfile?.email || user?.email || "",
        department: emp.department?.name || emp.departmentName || (typeof emp.department === "string" ? emp.department : "") || "General",
        designation: emp.designation?.name || (typeof emp.designation === "string" ? emp.designation : "") || "Staff",
        status: emp.status || "Active",
        joined: emp.joined || "",
        salary: emp.salary || 0,
        avatar: rawAvatar || user?.initials || "??",
        phone: emp.phone || "",
        address: emp.address || "",
        permanentAddress: emp.permanentAddress || "",
        personalEmail: emp.personalEmail || "",
        dob: emp.dob ? String(emp.dob).slice(0, 10) : "",
        gender: emp.gender || "Male",
        maritalStatus: emp.maritalStatus || "Single",
        bloodGroup: emp.bloodGroup || "O+",
        pan: emp.pan || "",
        aadhaar: emp.aadhaar || "",
        passportNumber: emp.passportNumber || "",
        uan: emp.uan || "",
        esic: emp.esic || "",
        emergencyContactNamePrimary: emp.emergencyContactNamePrimary || emp.emergencyContactName || "",
        emergencyContactRelPrimary: emp.emergencyContactRelPrimary || emp.emergencyContactRelation || "",
        emergencyContactPhonePrimary: emp.emergencyContactPhonePrimary || emp.emergencyContactPhone || "",
        emergencyContactNameSecondary: emp.emergencyContactNameSecondary || "",
        emergencyContactRelSecondary: emp.emergencyContactRelSecondary || "",
        emergencyContactPhoneSecondary: emp.emergencyContactPhoneSecondary || "",
        photoData: emp.photoData || (isImageSource(emp.avatar) ? emp.avatar : undefined),
        photoRotation: emp.photoRotation || 0,
      } as Employee;
    }

    return {
      id: authProfile?.id || user?.id || "USER",
      name: authProfile?.name || user?.name || "",
      email: authProfile?.email || user?.email || "",
      department: "Platform",
      designation: authProfile?.role === "SuperAdmin" ? "Platform Administrator" : "User",
      status: authProfile?.status || "Active",
      joined: authProfile?.createdAt ? String(authProfile.createdAt).slice(0, 10) : "",
      salary: 0,
      avatar: user?.initials || "??",
      phone: "",
      address: "",
      permanentAddress: "",
      personalEmail: "",
      dob: "",
      gender: "Male",
      maritalStatus: "Single",
      bloodGroup: "O+",
      pan: "",
      aadhaar: "",
      passportNumber: "",
      uan: "",
      esic: "",
      emergencyContactNamePrimary: "",
      emergencyContactRelPrimary: "",
      emergencyContactPhonePrimary: "",
      emergencyContactNameSecondary: "",
      emergencyContactRelSecondary: "",
      emergencyContactPhoneSecondary: "",
      photoData: undefined,
      photoRotation: 0,
    } as Employee;
  }, [authProfile, user]);

  const [profile, setProfile] = useState<Employee>(initialProfile);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoRotation, setPhotoRotation] = useState<number>(0);

  useEffect(() => {
    setProfile(initialProfile);
    setImgFailed(false);
    setPendingFile(null);
    setPreviewUrl(null);
    setPhotoRotation(0);
  }, [initialProfile]);

  const getInitials = (n: string) => {
    return extractInitials(n, profile.avatar);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Please select a valid image file (PNG, JPEG, WebP, etc.)", "error");
      return;
    }
    setPendingFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setPhotoRotation(0);
    setImgFailed(false);
    toast("Photo selected — click Save Changes to upload", "info");
  };

  const handleRotate = () => {
    setPhotoRotation((prev) => (prev + 90) % 360);
    toast("Photo rotated 90°", "info");
  };

  const handleDeletePhoto = () => {
    setPendingFile(null);
    setPreviewUrl(null);
    setPhotoRotation(0);
    setProfile((prev: Employee) => ({
      ...prev,
      avatar: "",
    }));
    setImgFailed(false);
    toast("Photo removed — click Save Changes to persist", "info");
  };

  const getRotatedFile = async (file: File, rotation: number): Promise<File> => {
    if (rotation === 0) return file;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);

        if (rotation === 90 || rotation === 270) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: file.type }));
          } else {
            resolve(file);
          }
        }, file.type);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const handleSave = async () => {
    const empId = authProfile?.employee?.id;
    if (!empId) {
      toast("Platform administrator accounts do not have an editable employee record.", "info");
      return;
    }

    setIsSaving(true);
    try {
      let savedAvatar = profile.avatar;

      // 1. If a new photo file was picked, upload to StorageService via dedicated avatar endpoint
      if (pendingFile) {
        const fileToUpload = await getRotatedFile(pendingFile, photoRotation);
        const uploadResult = await employeeService.uploadAvatar(empId, fileToUpload);
        if (uploadResult?.avatar) {
          savedAvatar = uploadResult.avatar;
        }
      }

      // 2. Update employee text details (strictly lightweight payload, no base64)
      const updatePayload: any = {
        name: profile.name,
        email: profile.email,
        avatar: savedAvatar || getInitials(profile.name),
        phone: profile.phone || undefined,
        address: profile.address || undefined,
        personalEmail: profile.personalEmail || undefined,
        permanentAddress: profile.permanentAddress || undefined,
        dob: profile.dob ? String(profile.dob).slice(0, 10) : undefined,
        gender: profile.gender || undefined,
        maritalStatus: profile.maritalStatus || undefined,
        bloodGroup: profile.bloodGroup || undefined,
        pan: profile.pan || undefined,
        aadhaar: profile.aadhaar || undefined,
        passportNumber: profile.passportNumber || undefined,
        uan: profile.uan || undefined,
        esic: profile.esic || undefined,
        emergencyContactNamePrimary: profile.emergencyContactNamePrimary || undefined,
        emergencyContactRelPrimary: profile.emergencyContactRelPrimary || undefined,
        emergencyContactPhonePrimary: profile.emergencyContactPhonePrimary || undefined,
        emergencyContactNameSecondary: profile.emergencyContactNameSecondary || undefined,
        emergencyContactRelSecondary: profile.emergencyContactRelSecondary || undefined,
        emergencyContactPhoneSecondary: profile.emergencyContactPhoneSecondary || undefined,
      };

      await employeeService.updateEmployee(empId, updatePayload);

      await queryClient.invalidateQueries({ queryKey: AUTH_PROFILE_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      await queryClient.invalidateQueries({ queryKey: ["orgchart"] });

      setPendingFile(null);
      setPreviewUrl(null);
      setPhotoRotation(0);

      const updatedUser = {
        ...user,
        name: profile.name,
        email: profile.email,
        employeeId: empId,
        avatar: savedAvatar || user?.avatar,
        initials: getInitials(profile.name),
      };
      setUser(updatedUser);
      localStorage.setItem("hrms.user", JSON.stringify(updatedUser));

      toast("Profile details updated successfully", "success");
    } catch (err: any) {
      toast(err.message || "Failed to update profile details", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const displayAvatar = useMemo(() => {
    if (previewUrl) return previewUrl;
    if (profile.avatar) return resolveAvatarUrl(profile.avatar, profile.id) || profile.avatar;
    return null;
  }, [previewUrl, profile.avatar, profile.id]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isEmployeeAccount = Boolean(authProfile?.employee?.id);

  return (
    <div className="space-y-6">
      {!isEmployeeAccount && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-2xl p-4 text-xs flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            You are logged in as a Platform User account. Employee profile information and payroll fields are managed by tenant administrators.
          </span>
        </div>
      )}

      {/* Header Summary */}
      <div className="flex flex-col md:flex-row gap-6 items-center bg-card p-6 rounded-2xl border border-border shadow-sm">
        {/* Profile Picture */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-28 w-28 overflow-hidden rounded-full border border-border bg-muted flex items-center justify-center shadow-md">
            {displayAvatar && !imgFailed ? (
              <img
                src={displayAvatar}
                alt={profile.name}
                className="h-full w-full object-cover transition-transform duration-200"
                style={{ transform: photoRotation ? `rotate(${photoRotation}deg)` : undefined }}
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="text-3xl font-extrabold text-muted-foreground select-none">
                {getInitials(profile.name)}
              </div>
            )}
          </div>
          {isEmployeeAccount && (
            <div className="flex gap-1.5">
              <label
                className="cursor-pointer p-1.5 rounded bg-muted hover:bg-primary hover:text-white text-muted-foreground transition"
                title="Upload Photo"
              >
                <Upload className="h-4 w-4" />
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
              {(previewUrl || profile.avatar) && (
                <>
                  <button
                    onClick={handleRotate}
                    className="p-1.5 rounded bg-muted hover:bg-primary hover:text-white text-muted-foreground transition"
                    title="Rotate 90°"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleDeletePhoto}
                    className="p-1.5 rounded bg-muted hover:bg-destructive hover:text-white text-muted-foreground transition"
                    title="Remove Photo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* User Details Overview */}
        <div className="text-center md:text-left space-y-1.5 flex-1">
          <h2 className="text-2xl font-extrabold text-foreground">{profile.name}</h2>
          <div className="flex flex-wrap justify-center md:justify-start gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
              {profile.designation}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
              {profile.department} Dept
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600">
              Joined {profile.joined}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Employee ID: <span className="font-bold text-foreground">{profile.id}</span> | Status:{" "}
            <span className="font-semibold text-emerald-500">{profile.status}</span>
          </p>
        </div>

        <Btn
          onClick={handleSave}
          variant="primary"
          className="shadow-lg shrink-0"
          disabled={!isEmployeeAccount || isSaving}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{isSaving ? "Saving..." : "Save Changes"}</span>
        </Btn>
      </div>

      {/* Main Form Fields Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Tabs */}
        <div className="flex flex-row lg:flex-col overflow-x-auto gap-2 bg-card p-3 rounded-2xl border border-border h-fit">
          <button
            onClick={() => setActiveTab("personal")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === "personal"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <User className="h-4 w-4" /> Personal Info
          </button>
          <button
            onClick={() => setActiveTab("id")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === "id"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Shield className="h-4 w-4" /> Identification
          </button>
          <button
            onClick={() => setActiveTab("contact")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === "contact"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Mail className="h-4 w-4" /> Communication
          </button>
          <button
            onClick={() => setActiveTab("emergency")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === "emergency"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <ShieldAlert className="h-4 w-4" /> Emergency Contact
          </button>
          {isEmployeeAccount && (
            <button
              onClick={() => setActiveTab("assets")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                activeTab === "assets"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Laptop className="h-4 w-4" /> My Assets ({myAssets.length})
            </button>
          )}
        </div>

        {/* Tab Forms */}
        <div className={cardCls + " lg:col-span-3 min-h-[300px]"}>
          {activeTab === "personal" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-bold border-b border-border pb-2 mb-4 text-foreground">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Full Name">
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Date of Birth">
                  <input
                    type="date"
                    value={profile.dob || ""}
                    onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Marital Status">
                  <select
                    value={profile.maritalStatus || "Single"}
                    onChange={(e) => setProfile({ ...profile, maritalStatus: e.target.value })}
                    className={inputCls}
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </Field>
                <Field label="Blood Group">
                  <select
                    value={profile.bloodGroup || "O+"}
                    onChange={(e) => setProfile({ ...profile, bloodGroup: e.target.value })}
                    className={inputCls}
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </Field>
                <Field label="Gender">
                  <select
                    value={profile.gender || "Male"}
                    onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                    className={inputCls}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {activeTab === "id" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-bold border-b border-border pb-2 mb-4 text-foreground">
                Identification Documents
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Aadhaar Card Number">
                  <input
                    type="text"
                    value={profile.aadhaar || ""}
                    onChange={(e) => setProfile({ ...profile, aadhaar: e.target.value })}
                    className={inputCls}
                    placeholder="e.g. 1234 5678 9012"
                  />
                </Field>
                <Field label="PAN Card Number">
                  <input
                    type="text"
                    value={profile.pan || ""}
                    onChange={(e) => setProfile({ ...profile, pan: e.target.value })}
                    className={inputCls}
                    placeholder="e.g. ABCDE1234F"
                  />
                </Field>
                <Field label="Passport Number">
                  <input
                    type="text"
                    value={profile.passportNumber || ""}
                    onChange={(e) => setProfile({ ...profile, passportNumber: e.target.value })}
                    className={inputCls}
                    placeholder="e.g. A1234567"
                  />
                </Field>
                <Field label="UAN Number">
                  <input
                    type="text"
                    value={profile.uan || ""}
                    onChange={(e) => setProfile({ ...profile, uan: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          )}

          {activeTab === "contact" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-bold border-b border-border pb-2 mb-4 text-foreground">
                Communication & Addresses
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Official Email ID">
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Personal Email ID">
                  <input
                    type="email"
                    value={profile.personalEmail || ""}
                    onChange={(e) => setProfile({ ...profile, personalEmail: e.target.value })}
                    className={inputCls}
                    placeholder="e.g. myname@gmail.com"
                  />
                </Field>
                <Field label="Mobile Number">
                  <input
                    type="text"
                    value={profile.phone || ""}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Current/Residential Address">
                    <textarea
                      value={profile.address || ""}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                      className="w-full min-h-[80px] bg-background border border-input rounded-lg p-3 text-xs outline-none focus:border-primary text-foreground"
                    />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Permanent Address">
                    <textarea
                      value={profile.permanentAddress || ""}
                      onChange={(e) => setProfile({ ...profile, permanentAddress: e.target.value })}
                      className="w-full min-h-[80px] bg-background border border-input rounded-lg p-3 text-xs outline-none focus:border-primary text-foreground"
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {activeTab === "emergency" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Primary Contact */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold border-b border-border pb-2 text-foreground">
                  Primary Emergency Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Contact Name">
                    <input
                      type="text"
                      value={profile.emergencyContactNamePrimary || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, emergencyContactNamePrimary: e.target.value })
                      }
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Relationship">
                    <input
                      type="text"
                      value={profile.emergencyContactRelPrimary || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, emergencyContactRelPrimary: e.target.value })
                      }
                      className={inputCls}
                      placeholder="e.g. Spouse / Sibling"
                    />
                  </Field>
                  <Field label="Mobile Number">
                    <input
                      type="text"
                      value={profile.emergencyContactPhonePrimary || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, emergencyContactPhonePrimary: e.target.value })
                      }
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>

              {/* Secondary Contact */}
              <div className="space-y-4 pt-4">
                <h3 className="text-sm font-bold border-b border-border pb-2 text-foreground">
                  Secondary Emergency Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Contact Name">
                    <input
                      type="text"
                      value={profile.emergencyContactNameSecondary || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, emergencyContactNameSecondary: e.target.value })
                      }
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Relationship">
                    <input
                      type="text"
                      value={profile.emergencyContactRelSecondary || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, emergencyContactRelSecondary: e.target.value })
                      }
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Mobile Number">
                    <input
                      type="text"
                      value={profile.emergencyContactPhoneSecondary || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, emergencyContactPhoneSecondary: e.target.value })
                      }
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {activeTab === "assets" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-bold border-b border-border pb-2 mb-4 text-foreground flex items-center justify-between">
                <span>Hardware & Company Assets Assigned to You</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {myAssets.length} active allocation{myAssets.length === 1 ? "" : "s"}
                </span>
              </h3>

              {isLoadingMyAssets ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : myAssets.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border p-6">
                  No hardware or company assets currently assigned to your profile.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myAssets.map((asset) => (
                    <div key={asset.id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-foreground">{asset.name}</h4>
                          <p className="text-xs text-muted-foreground">{asset.category || asset.type}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                          {asset.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/50">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Asset Tag</span>
                          <span className="font-mono font-medium text-foreground">{asset.assetTag || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Serial Number</span>
                          <span className="font-mono text-foreground">{asset.serialNumber || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Handover Date</span>
                          <span className="text-foreground">{asset.assignedDate || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Condition</span>
                          <span className="text-foreground">{asset.condition || "Good"}</span>
                        </div>
                      </div>

                      {asset.notes && (
                        <p className="text-[11px] text-muted-foreground italic bg-background/50 p-2 rounded">
                          {asset.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
