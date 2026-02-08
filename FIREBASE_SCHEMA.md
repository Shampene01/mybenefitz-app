# MyBenefitz — Firestore Schema Specification

> **Version:** 1.0
> **Last Updated:** 2026-02-07
> **Audience:** Integration partners, mobile/web developers, third-party channel implementors

This document defines the canonical Firestore database schema for the MyBenefitz platform. All fulfillment channels (WhatsApp, Mobile App, Web App, Partner APIs) **must** conform to these schemas to ensure data flows correctly through the platform and synchronises to the central Azure SQL database.

---

## 1. Firestore Project

| Property | Value |
|----------|-------|
| **Project ID** | `my-benefits-portal-463t8v` |
| **Database** | `(default)` |
| **Region** | `eur3` (Europe multi-region) |

---

## 2. Collections at a Glance

```
Firestore
├── contacts/{contactId}                    Client profiles
│   └── consents/{consentId}                Product consent records
│
├── users/{uid}                             App user profiles (authenticated)
│   └── consents/{consentId}                Product consent records
│
├── conversations/{waId}                    (WhatsApp only — message audit)
│   └── messages/{messageId}
│
└── events/{eventId}                        (Internal — webhook audit log)
```

| Collection | Purpose | Who Writes | Syncs to Azure SQL |
|------------|---------|------------|-------------------|
| `contacts` | Client profile & product state | WhatsApp, Mobile App, Web App, Partners | Yes |
| `users` | Authenticated app user profile | Mobile App, Web App, Admin Portal | Yes |
| `consents` | Per-product consent records (sub-collection) | All channels | Yes (via parent trigger) |
| `conversations` | WhatsApp message history | WhatsApp only | No |
| `events` | Webhook audit trail | Internal | No |

---

## 3. Schema Rules (All Channels Must Follow)

### 3.1 Timestamps

All timestamp fields **must** be stored as **ISO 8601 UTC strings**.

```
✅  "2026-02-07T12:00:00Z"
✅  "2026-02-07T14:30:00.000Z"
❌  1738915200                    ← Unix epoch (seconds)
❌  1738915200000                 ← Unix epoch (milliseconds)
❌  Firestore Timestamp object    ← Server-side type, not portable
```

### 3.2 Document IDs

| Collection | ID Format | Example |
|------------|-----------|---------|
| `contacts` | `{phoneNumber}-{surname_lowercase}` or `{phoneNumber}` if surname unknown | `27730192380-smith` |
| `users` | Firebase Auth UID | `abc123XYZ...` |
| `consents` | Auto-generated | `XESDvTkqq93Btqjmyzyw` |

### 3.3 Required Fields

Fields marked **required** must be present before triggering any product flow. Missing fields will cause the Azure SQL sync to fail or produce incomplete records.

### 3.4 Phone Numbers

Store phone numbers in **international format without the `+` prefix**.

```
✅  "27730192380"
❌  "+27730192380"
❌  "0730192380"
```

### 3.5 SA ID Numbers

South African ID numbers must be the full **13-digit** string. Date of birth and gender are derived from this automatically — do not store them separately on the Firestore document.

```
✅  "8801015800086"
❌  "880101580008"     ← 12 digits
```

---

## 4. Collection: `contacts/{contactId}`

The primary client profile document. Used by all channels to store client information and track product application state.

### 4.1 Identity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `waId` | `string` | **Yes** | Phone number (international, no `+`) |
| `fullName` | `string` | **Yes** | Client's full name |
| `surname` | `string` | **Yes** | Client's surname |
| `idNumber` | `string` | **Yes** (for products) | SA ID Number (13 digits) |
| `email` | `string` | Recommended | Email address |
| `phoneNumber` | `string` | No | Alternative phone number |

### 4.2 Onboarding & Consent

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `onboarded` | `boolean` | **Yes** | `true` once POPIA consent is granted |
| `popiaConsent` | `boolean` | **Yes** | POPIA consent granted |
| `popiaConsentTimestamp` | `string` | **Yes** | ISO 8601 when POPIA consent was granted |

### 4.3 Product Status Fields

Each product has its own status field tracking the client's progress through that product's flow.

#### Credit Repair (Credit Clinic)

| Field | Type | Description |
|-------|------|-------------|
| `creditClinicStatus` | `string \| null` | See [Section 6.1](#61-credit-repair-credit-clinic) for values |
| `creditClinicAppliedAt` | `string` | ISO 8601 when application started |
| `activeProduct` | `string \| null` | Currently active product: `"credit_clinic"` |
| `pendingPaymentId` | `string` | Payment reference (e.g. `"CR-27730192380-abc123"`) |
| `pendingConsentId` | `string` | Consent document ID linked to this application |

### 4.4 System Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `createdAt` | `string` | **Yes** | ISO 8601 document creation timestamp |
| `updatedAt` | `string` | **Yes** | ISO 8601 last update timestamp |

### 4.5 Example Document

```json
{
  "waId": "27730192380",
  "fullName": "John Smith",
  "surname": "Smith",
  "idNumber": "8801015800086",
  "email": "john@example.com",
  "onboarded": true,
  "popiaConsent": true,
  "popiaConsentTimestamp": "2026-02-07T12:00:00Z",
  "activeProduct": "credit_clinic",
  "creditClinicStatus": "payment_received",
  "creditClinicAppliedAt": "2026-02-07T12:00:00Z",
  "pendingPaymentId": "CR-27730192380-abc123",
  "pendingConsentId": "XESDvTkqq93Btqjmyzyw",
  "createdAt": "2026-02-07T11:00:00Z",
  "updatedAt": "2026-02-07T12:30:00Z"
}
```

---

## 5. Sub-Collection: `consents/{consentId}`

**Path:** `contacts/{contactId}/consents/{consentId}` or `users/{uid}/consents/{consentId}`

Each product application requires a consent record. The platform reads the **most recent** consent of a given type when processing product events.

### 5.1 Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `consentId` | `string` | **Yes** | Same as document ID |
| `waId` | `string` | **Yes** | Phone number of the client |
| `consentType` | `string` | **Yes** | Product consent category (see table below) |
| `fullName` | `string` | **Yes** | Full name at time of consent |
| `surname` | `string` | **Yes** | Surname at time of consent |
| `idNumber` | `string` | Product-dependent | SA ID Number |
| `popiaConsent` | `boolean` | **Yes** | POPIA consent granted |
| `creditReportConsent` | `boolean` | Product-dependent | Consent to pull credit report |
| `whatsAppContactConsent` | `boolean` | Product-dependent | Consent to WhatsApp contact |
| `otpVerified` | `boolean` | **Yes** | Whether identity was verified |
| `otpCode` | `string` | **Yes** | Verification code (hashed, never plaintext) |
| `otpVerifiedAt` | `string` | **Yes** | ISO 8601 verification timestamp |
| `consentGrantedAt` | `string` | **Yes** | ISO 8601 when all consents were confirmed |
| `createdAt` | `string` | **Yes** | ISO 8601 record creation timestamp |

### 5.2 Consent Types

| `consentType` Value | Product | Required Consent Flags |
|---------------------|---------|------------------------|
| `credit_report` | Credit Repair / Credit Clinic | `popiaConsent`, `creditReportConsent`, `whatsAppContactConsent` |
| `wills_estate` | Wills & Estate *(planned)* | `popiaConsent`, TBD |
| `life_insurance` | Life Insurance *(planned)* | `popiaConsent`, TBD |
| `funeral_cover` | Funeral Cover *(planned)* | `popiaConsent`, TBD |

### 5.3 Example Document

```json
{
  "consentId": "XESDvTkqq93Btqjmyzyw",
  "waId": "27730192380",
  "consentType": "credit_report",
  "fullName": "John Smith",
  "surname": "Smith",
  "idNumber": "8801015800086",
  "popiaConsent": true,
  "creditReportConsent": true,
  "whatsAppContactConsent": true,
  "otpVerified": true,
  "otpCode": "a1b2c3d4e5f6...",
  "otpVerifiedAt": "2026-02-07T12:05:00Z",
  "consentGrantedAt": "2026-02-07T12:05:00Z",
  "createdAt": "2026-02-07T12:05:00Z"
}
```

---

## 6. Product Flows

### 6.1 Credit Repair (Credit Clinic)

**Product Code:** `CREDIT_REPAIR`
**Consent Type:** `credit_report`

#### Status Progression

The `creditClinicStatus` field on the contact document tracks progress:

```
null → pending_consent → pending_payment → payment_received → generating_report → report_delivered → completed
```

| Status | Meaning | What Happens Next |
|--------|---------|-------------------|
| `null` | Not started | Client selects Credit Clinic |
| `pending_consent` | Awaiting OTP consent confirmation | Client verifies OTP |
| `pending_payment` | Payment link sent, awaiting payment | Client pays via payment link |
| **`payment_received`** | **Payment confirmed** | **Triggers sync to Azure SQL** |
| `generating_report` | Credit report being pulled | Report processing |
| `report_delivered` | Report sent to client | Awaiting review |
| `completed` | Case closed | — |

#### Required Data Before `payment_received`

Before setting `creditClinicStatus` to `"payment_received"`, the following **must** be in place:

**On the contact document:**
- `waId` — phone number
- `fullName` — client full name
- `surname` — client surname
- `idNumber` — 13-digit SA ID number
- `popiaConsent` — `true`
- `popiaConsentTimestamp` — ISO 8601 string
- `creditClinicAppliedAt` — ISO 8601 string
- `pendingPaymentId` — payment reference string

**In the `consents` sub-collection:**
- One document with `consentType: "credit_report"`
- All required consent flags set to `true`
- OTP verification completed

#### What Happens on `payment_received`

1. A Cloud Function detects the `creditClinicStatus` change to `"payment_received"`
2. It reads the contact document and the latest `credit_report` consent
3. It publishes a sync event containing all client and consent data
4. The sync pipeline creates/updates the following in Azure SQL:
   - **Client record** (upsert by ID number)
   - **Product application** (Credit Repair application)
   - **Credit Repair case** (initial stage: Document Collection)

### 6.2 Wills & Estate *(Planned)*

**Product Code:** `WILLS_ESTATE`
**Consent Type:** `wills_estate`

*Schema to be defined. Will follow the same pattern as Credit Repair:*
- *Status field on contact: `willsEstateStatus`*
- *Consent type: `wills_estate`*
- *Trigger condition: status transition to a defined value*

### 6.3 Life Insurance *(Planned)*

**Product Code:** `LIFE_INSURANCE`
**Consent Type:** `life_insurance`

*Schema to be defined.*

### 6.4 Funeral Cover *(Planned)*

**Product Code:** `FUNERAL_COVER`
**Consent Type:** `funeral_cover`

*Schema to be defined.*

---

## 7. Collection: `users/{uid}`

Used by the Mobile App and Web App for authenticated user profiles. Document ID **must** match the Firebase Authentication UID.

### 7.1 Identity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | `string` | **Yes** | Email address |
| `firstName` | `string` | **Yes** | First name |
| `lastName` | `string` | **Yes** | Last name / surname |
| `displayName` | `string` | **Yes** | Display name (auto-derived: `firstName + lastName`) |
| `phoneNumber` | `string` | Recommended | Phone number (international, no `+`) |
| `whatsappNumber` | `string` | Recommended | WhatsApp number (international, no `+`). May differ from `phoneNumber` |
| `idNumber` | `string` | For products | SA ID Number (13 digits) |
| `photoURL` | `string` | No | Profile photo URL |
| `tenantId` | `string` | **Yes** | Tenant GUID |
| `role` | `string` | **Yes** | User role: `"user"`, `"admin"`, `"broker"` |
| `subscriptionPlan` | `string` | No | Subscription plan |
| `source` | `string` | **Yes** | `"self-registration"`, `"azure-sync"`, `"whatsapp"` |
| `createdAt` | `string` | **Yes** | ISO 8601 creation timestamp |
| `updatedAt` | `string` | **Yes** | ISO 8601 last update timestamp |

### 7.2 Address Map

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | `map` | Recommended | Physical address (see sub-fields below) |
| `address.street` | `string` | **Yes** | Street address (e.g., `"123 Main Rd"`) |
| `address.unitNumber` | `string` | No | Unit / apartment number (e.g., `"Unit 4"`) |
| `address.complexName` | `string` | No | Complex / estate name (e.g., `"Sunset Estate"`) |
| `address.suburb` | `string` | **Yes** | Suburb (e.g., `"Sandton"`) |
| `address.city` | `string` | **Yes** | Town / City (e.g., `"Johannesburg"`) |
| `address.province` | `string` | **Yes** | One of the 9 SA provinces (see list below) |
| `address.postalCode` | `string` | No | Postal code (e.g., `"2196"`) |

**Valid `province` values:**
`"Eastern Cape"`, `"Free State"`, `"Gauteng"`, `"KwaZulu-Natal"`, `"Limpopo"`, `"Mpumalanga"`, `"North West"`, `"Northern Cape"`, `"Western Cape"`

### 7.3 Income Details Map

Employment and income information. Required for loan and credit product applications.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `income` | `map` | Recommended | Income details (see sub-fields below) |
| `income.employerName` | `string` | **Yes** (if income provided) | Employer / company name |
| `income.employerEmail` | `string` | Recommended | Employer HR / payroll email |
| `income.grossSalary` | `number` | **Yes** (if income provided) | Monthly gross salary in ZAR (cents avoided — store as rands, e.g. `25000`) |
| `income.netSalary` | `number` | **Yes** (if income provided) | Monthly net (take-home) salary in ZAR |

### 7.4 FICA Documents Map

FICA (Financial Intelligence Centre Act) compliance documents. Each field stores the Firebase Storage download URL of the uploaded document.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fica` | `map` | Recommended | FICA document references (see sub-fields below) |
| `fica.idDocument` | `string` | For products | Download URL — certified copy of SA ID or Smart ID card |
| `fica.payslip` | `string` | For products | Download URL — latest payslip (not older than 3 months) |
| `fica.bankConfirmation` | `string` | For products | Download URL — bank confirmation letter or stamped statement |
| `fica.idDocumentUploadedAt` | `string` | Auto | ISO 8601 timestamp when ID document was uploaded |
| `fica.payslipUploadedAt` | `string` | Auto | ISO 8601 timestamp when payslip was uploaded |
| `fica.bankConfirmationUploadedAt` | `string` | Auto | ISO 8601 timestamp when bank confirmation was uploaded |

> **Storage path:** `users/{uid}/fica/{documentType}.{ext}`
> **Allowed types:** `image/jpeg`, `image/png`, `application/pdf`
> **Max size:** 5 MB per file

### 7.5 Preferences Map

User preferences that control UI display and feature visibility.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `preferences` | `map` | No | User preferences (see sub-fields below) |
| `preferences.showEarnings` | `boolean` | No | Whether to show the Monthly Earnings card on home screen. Default: `true`. Users focused on products can hide it. |
| `preferences.interest` | `string` | No | User's primary interest: `"products"`, `"affiliate"`, or `"both"`. Default: `"both"`. |

### 7.6 Affiliate Map

Affiliate / referral programme data. Populated when a user participates in the referral programme.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `affiliate` | `map` | No | Affiliate earnings data (see sub-fields below) |
| `affiliate.referralCode` | `string` | No | Unique referral code for sharing |
| `affiliate.totalEarnings` | `number` | No | Cumulative total earnings in ZAR |
| `affiliate.monthlyEarnings` | `number` | No | Current month's earnings in ZAR |
| `affiliate.pendingEarnings` | `number` | No | Earnings awaiting client premium receipt |
| `affiliate.referralCount` | `number` | No | Total number of referred clients |

> **Commission policy:** Commissions are paid only after receipt of the referred client's premium for a product they have taken. No upfront commissions are paid.

### 7.7 Example Document

```json
{
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Smith",
  "displayName": "John Smith",
  "phoneNumber": "27730192380",
  "whatsappNumber": "27730192380",
  "idNumber": "8801015800086",
  "tenantId": "36e92b55-631e-476d-95e4-220a9dadda6c",
  "role": "user",
  "source": "self-registration",
  "address": {
    "street": "123 Main Rd",
    "unitNumber": "Unit 4",
    "complexName": "Sunset Estate",
    "suburb": "Sandton",
    "city": "Johannesburg",
    "province": "Gauteng",
    "postalCode": "2196"
  },
  "income": {
    "employerName": "Acme Corporation",
    "employerEmail": "hr@acme.co.za",
    "grossSalary": 25000,
    "netSalary": 18500
  },
  "fica": {
    "idDocument": "https://firebasestorage.googleapis.com/v0/b/.../users/abc123/fica/idDocument.pdf",
    "payslip": "https://firebasestorage.googleapis.com/v0/b/.../users/abc123/fica/payslip.pdf",
    "bankConfirmation": "https://firebasestorage.googleapis.com/v0/b/.../users/abc123/fica/bankConfirmation.pdf",
    "idDocumentUploadedAt": "2026-02-07T13:00:00Z",
    "payslipUploadedAt": "2026-02-07T13:05:00Z",
    "bankConfirmationUploadedAt": "2026-02-07T13:10:00Z"
  },
  "preferences": {
    "showEarnings": true,
    "interest": "both"
  },
  "affiliate": {
    "referralCode": "JOHN1234",
    "totalEarnings": 1250.00,
    "monthlyEarnings": 350.00,
    "pendingEarnings": 150.00,
    "referralCount": 8
  },
  "createdAt": "2026-02-07T12:00:00Z",
  "updatedAt": "2026-02-07T13:10:00Z"
}
```

---

## 8. Firestore Indexes

The following composite indexes are required:

| Collection Path | Fields | Purpose |
|----------------|--------|---------|
| `contacts` | `waId` (ASC) | Query contacts by phone number |
| `contacts/{id}/consents` | `consentType` (ASC), `createdAt` (DESC) | Get latest consent by type |

---

## 9. Linking `contacts` and `users`

| Scenario | Document Used |
|----------|--------------|
| Client interacts via WhatsApp only | `contacts/{contactId}` |
| User registers via Mobile/Web App | `users/{uid}` |
| Client uses both channels | Both documents exist |

When a client exists in both collections, they are linked in Azure SQL by their **`idNumber`** and/or **`email`**. The sync pipeline handles deduplication at the SQL level.

**Recommendation:** When a Mobile/Web App user also has a WhatsApp contact, consider setting a `linkedContactId` or `linkedUid` field to explicitly connect the documents.

---

## 10. Adding a New Product

1. Choose a **product code** (e.g., `WILLS_ESTATE`) and **consent type** (e.g., `wills_estate`)
2. Add a status field to the contact document (e.g., `willsEstateStatus`)
3. Define the consent flags required for this product
4. Create consent documents in the `consents` sub-collection with the new `consentType`
5. Set the trigger condition (which status value triggers the Azure SQL sync)
6. Ensure all required data is populated before the trigger fires
7. Contact the platform team to add the sync handler
