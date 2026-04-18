export interface SharedFile {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  recipientId: string;
  storagePath?: string;
}

export interface AuditMetadata {
  adminId: string;
  adminName: string;
  adminOfficeId?: string;
  timestamp: string;
  action: string;
  details?: string;
}

export interface Reminder {
  id: string;
  creatorId: string;
  assignedToId?: string;
  title: string;
  description?: string;
  dueDate: string;
  status: 'pending' | 'completed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  audit?: AuditMetadata;
}

export interface OfficeAssignment {
  officeId: string;
  officeCode: string;
  status: 'active' | 'inactive';
  assignedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber: string;
  dob: string;
  role: 'admin' | 'client' | 'employee' | 'contractor';
  status: 'active' | 'blocked' | 'paused';
  createdAt: string;
  adminId?: string;
  statusChangedBy?: string;
  updatedBy?: string;
  firstName?: string;
  jobTitle?: string;
  officeAddress?: string;
  officeStreet?: string;
  officeZip?: string;
  officeCity?: string;
  officeState?: string;
  officeCountry?: string;
  personalPhone?: string;
  officePhone?: string;
  adminRank?: 'super' | 'senior' | 'junior';
  preferredLanguage?: string;
  primaryLanguage?: string;
  promotedByAdminId?: string;
  promotedAt?: string;
  streetAddress?: string;
  city?: string;
  stateProvince?: string;
  country?: string;
  zipCode?: string;
  clientId?: string;
  theme?: 'light' | 'dark';
  updatedAt?: string;
  photoURL?: string;
  calendarUrl?: string;
  languages?: string;
  topSpecialties?: string;
  credentials?: string;
  yearsOfExperience?: string;
  referrerId?: string;
  referrerName?: string;
  referrerClientId?: string;
  adminSignature?: string;
  activeFlag?: 'green' | 'yellow' | 'red';
  flagNotes?: {
    green?: string;
    yellow?: string;
    red?: string;
  };
  referralCode?: string;
  referralCreditPaid?: boolean;
  referralCreditPaidAt?: string;
  referralCreditPaidBy?: string;
  referralCreditAmount?: string;
  referralCreditPaymentMethod?: string;
  secondaryPhoneNumber?: string;
  officeId?: string;
  officeCode?: string;
  officeIdNumber?: string;
  officeAssignments?: OfficeAssignment[];
  reachStatus?: {
    green: boolean;
    yellow: boolean;
    updatedAt: number;
  };
  isManualVIP?: boolean;
  audit?: AuditMetadata | AuditMetadata[];
  isContractor?: boolean;
  contractorType?: 'company' | 'individual';
  legalCompanyName?: string;
  companyTaxId?: string;
  taxIdType?: string;
  companyLegalStructure?: string;
  membersOrShareholders?: string;
  bestPhoneNumber?: string;
  bestEmailAddress?: string;
  companyLegalAddress?: string;
  companyLegalAddressStreet?: string;
  companyLegalAddressCity?: string;
  companyLegalAddressState?: string;
  companyLegalAddressZip?: string;
  otherCompanyAddress?: string;
  otherCompanyAddressStreet?: string;
  otherCompanyAddressCity?: string;
  otherCompanyAddressState?: string;
  otherCompanyAddressZip?: string;
  companyRegisteredRegion?: string;
  serviceType?: string;
  serviceStartDate?: string;
  serviceEndDate?: string;
  legalRepresentativeName?: string;
  legalRepresentativePhone?: string;
  legalRepresentativeEmail?: string;
  projectManagerName?: string;
  projectManagerPhone?: string;
  projectManagerEmail?: string;
  serviceFee?: string;
  otherFeesDescription?: string;
  note?: string;
  legalName?: string;
  taxIdentification?: string;
  currentAddress?: string;
  currentAddressStreet?: string;
  currentAddressCity?: string;
  currentAddressState?: string;
  currentAddressZip?: string;
  otherAddress?: string;
  otherAddressStreet?: string;
  otherAddressCity?: string;
  otherAddressState?: string;
  otherAddressZip?: string;
  birthRegion?: string;
  mainSpecialization?: string;
  serviceFeeDescription?: string;
  contractType?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  contractorFirstName?: string;
  contractorLastName?: string;
  contractorDisplayName?: string;
  isEmployee?: boolean;
  employeeDisplayName?: string;
  employeeFirstName?: string;
  employeeMiddleName?: string;
  employeeLastName?: string;
  employeeDob?: string;
  employeeStreetAddress?: string;
  employeeCity?: string;
  employeeStateProvince?: string;
  employeeZipCode?: string;
  employeeCountry?: string;
  employeePersonalPhone?: string;
  teamLeaderId?: string;
  department?: string;
  benefits?: string[];
  clockInHistory?: {
    date: string;
    clockIn: string;
    clockOut?: string;
    status: 'on-time' | 'late' | 'absent';
  }[];
  googleDriveFolderLink?: string;
  employeeFiles?: {
    id: string;
    name: string;
    url: string;
    type: string;
    uploadedAt: string;
    visibleToEmployee: boolean;
    folderId?: string;
  }[];
  employeeFolders?: {
    id: string;
    name: string;
    createdAt: string;
  }[];
  taxId?: string;
  hireDate?: string;
  middleName?: string;
  lastName?: string;
  emergencyContactFirstName?: string;
  emergencyContactLastName?: string;
  emergencyContactPhone?: string;
  emergencyContactEmail?: string;
  sickHoursBalance?: number;
  vacationHoursBalance?: number;
  ptoHoursBalance?: number;
  weeklyErrandsHoursBalance?: number;
  lastYearlyAllocation?: number;
  isSupervisor?: boolean;
  supervisorId?: string;
}

export interface Referral {
  id: string;
  type: 'company' | 'individual';
  legalCompanyName?: string;
  phoneNumber?: string;
  emailAddress?: string;
  physicalAddress?: string;
  availableServices?: string;
  availableProducts?: string;
  yearsOfExperience?: string;
  note?: string;
  fullName?: string;
  currentAddress?: string;
  specialization?: string;
  createdAt: string;
  audit?: AuditMetadata;
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'sick' | 'vacation' | 'pto' | 'errands';
  amount: number;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  reason?: string;
  audit?: AuditMetadata;
}

export interface Office {
  id: string;
  officeCode?: string;
  nickName: string;
  streetAddress: string;
  city: string;
  stateProvince: string;
  zipCode: string;
  mainPhone: string;
  managerName: string;
  managerPhone: string;
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt?: string;
  audit?: AuditMetadata;
}

export interface Folder {
  id: string;
  clientId: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  folderId?: string;
  fileId?: string;
  clientId: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
  fileName?: string;
  fileData?: string;
  uploadedBy: 'admin' | 'client';
  createdAt: string;
  updatedAt?: string;
  adminId?: string;
  updatedBy?: string;
  isLink?: boolean;
  source?: string;
}

export interface FileContainer {
  id: string;
  clientId: string;
  name: string;
  type: 'main' | 'secondary';
  category?: 'Personal' | 'Business' | 'Dependent Person';
  isOpen: boolean;
  isVisibleToUser?: boolean;
  visibleUntil?: string;
  createdAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface PartialPayment {
  amount: string;
  date: string;
  method?: string;
  reference?: string;
}

export interface Conversation {
  id: string;
  clientId: string;
  clientName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  updatedAt: string;
}

export interface Message {
  id: string;
  clientId: string;
  senderId: string;
  senderName: string;
  senderJobId?: string;
  text: string;
  fileName?: string;
  fileData?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  date: string;
  service: string;
  status: 'Complete' | 'Process' | 'Cancelled' | string;
  paymentStatus?: 'FullPay' | 'PaPay' | 'NoPay' | string;
  paymentMethod?: string;
  cancellationReason?: string;
  partialPaymentAmount?: string;
  partialPaymentDate?: string;
  partialPayments?: PartialPayment[];
  notes?: string;
  createdAt: string;
  performedBy?: string;
  assignedAdminId?: string;
  assignedAdminName?: string;
  assignedAdminJobId?: string;
  assignerAdminName?: string;
  assignedBy?: string;
  assignerAdminJobId?: string;
  requestedByAdminId?: string;
  dueDate?: string;
  mission?: string;
  missionAccomplished?: boolean;
  missionAccomplishedAt?: string;
  audit?: AuditMetadata | AuditMetadata[];
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'individual' | 'business' | 'workshop';
  performedBy?: string;
  imageUrl?: string;
  paymentLink?: string;
  formUrl?: string;
  audit?: AuditMetadata | AuditMetadata[];
}

export interface FormTemplate {
  id: string;
  formId: string;
  title: string;
  description: string;
  headerImage?: string;
  fields: {
    id: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
  }[];
  audit?: AuditMetadata | AuditMetadata[];
}

export interface FormSubmission {
  id: string;
  templateId: string;
  formId: string;
  clientId: string;
  clientName: string;
  data: Record<string, any>;
  submittedAt: string;
}
