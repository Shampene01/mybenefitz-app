Plan: ProfileGuard & Home Affairs ID Verification for Mobile App
Context
The mybenefitz-web app has smart profiling features that ensure data quality before users can apply for products: a ProfileGuard that blocks access to product pages when profiles are incomplete or flagged, Home Affairs ID verification with fuzzy name matching to detect fraud, locked fields after verification, a nudge banner on the dashboard, and bonus health score points for verified profiles. These features need to be ported to the mobile app.

Files to Create (2)
File	Purpose
lib/verification.ts	Fuzzy name matching (fuzzyMatch) + Home Affairs API call (verifyWithHomeAffairs)
components/ProfileGuard.tsx	Route guard component — redirects incomplete profiles, blocks flagged accounts
Files to Modify (12)
File	Change
contexts/AuthContext.tsx	Add IdentityVerification interface, extend UserProfile with verification + flag fields, expose isProfileComplete, isHomeAffairsVerified, isAccountFlagged
app/edit-profile.tsx	Integrate Home Affairs verification on save, lock verified fields, show verification banner, handle returnTo param
app/(tabs)/index.tsx	Add dismissible nudge banner when profile incomplete
components/HealthScoreGauge.tsx	Conditional points (10 if HA-verified, 5 if not) for Personal Details milestone
app/credit-apply.tsx	Wrap with <ProfileGuard>
app/loan-apply.tsx	Wrap with <ProfileGuard>
app/life-insurance-apply.tsx	Wrap with <ProfileGuard>
app/retirement-apply.tsx	Wrap with <ProfileGuard>
app/tax-free-savings-apply.tsx	Wrap with <ProfileGuard>
app/wills-estates-apply.tsx	Wrap with <ProfileGuard>
app/funeral-cover-apply.tsx	Wrap with <ProfileGuard>
app/affiliate-apply.tsx	Wrap with <ProfileGuard>
Step 1: Extend AuthContext types and computed values
File: contexts/AuthContext.tsx

Add IdentityVerification interface (after UserFica, ~line 38):

status: 'not_verified' | 'pending_verification' | 'home_affairs_verified'
method, verifiedAt, verifiedFirstNames, verifiedLastName, verifiedDateOfBirth, verifiedGender, verifiedCitizenship, verifiedAge, dateIssued, lockedFields, requestedAt, failureReason
Add to UserProfile interface:

identityVerification?: IdentityVerification
accountFlagged?: boolean, accountFlaggedReason?: string, accountFlaggedAt?: string
Add to AuthContextType interface:

isProfileComplete: boolean, isHomeAffairsVerified: boolean, isAccountFlagged: boolean
Add computed values inside AuthProvider (before return):


isProfileComplete = firstName && lastName && idNumber && phoneNumber && address.street/suburb/city/province && income.employerName/grossSalary
isHomeAffairsVerified = identityVerification?.status === 'home_affairs_verified'
isAccountFlagged = !!accountFlagged
Expose all three in the Provider value object.

Step 2: Create lib/verification.ts
Port from web profile/page.tsx lines 140-235:

fuzzyMatch(input, verified) — returns { matches, score, isFraud }

Exact match → score 1.0
Initial match (≤3 chars, starts with) → 0.85
Contains match → 0.9
Multi-name parts check → 0.85
Levenshtein distance → matches if ≥ 0.6, fraud if < 0.3
verifyWithHomeAffairs(idNumber, idToken) — POST to https://home-affairs-service-867203198671.africa-south1.run.app/api/verify

Returns { success, error?, verification?: { firstName, lastName } }
Step 3: Create components/ProfileGuard.tsx
React Native equivalent of web ProfileGuard:

Uses useAuth() for isProfileComplete, isAccountFlagged, loading
Loading → spinner
Flagged → red suspension screen with WhatsApp contact button (+27 64 340 4602)
Incomplete → router.replace('/edit-profile', { returnTo: pathname })
OK → render children
Step 4: Wrap all 8 product apply screens with ProfileGuard
Add import ProfileGuard and wrap outermost JSX:


return <ProfileGuard>...existing content...</ProfileGuard>
Files: credit-apply, loan-apply, life-insurance-apply, retirement-apply, tax-free-savings-apply, wills-estates-apply, funeral-cover-apply, affiliate-apply

Step 5: Integrate Home Affairs verification into edit-profile.tsx
New imports: useLocalSearchParams, auth, isValidSAID, fuzzyMatch, verifyWithHomeAffairs

New state/derived values:

returnTo from search params
verifying loading state
isHomeAffairsVerified, isAccountFlagged from useAuth()
isIdLocked, isNameLocked derived from identityVerification
Modified handleSave flow:

If isAccountFlagged → alert and return
Validate ID with isValidSAID if present
If shouldVerify (has idNumber, not yet verified, not yet attempted):
Get Firebase ID token
Call verifyWithHomeAffairs
Fuzzy match first + last names
Fraud (score < 0.3) → flag account, alert, return
Mismatch (not fraud) → alert to correct names, return
Match → save with HA-verified names, update identityVerification status
If not verifying → save normally (existing logic)
On success → navigate to returnTo if present, else router.back()
UI changes:

Lock firstName, lastName, idNumber inputs when verified (editable={false}, lock icon)
Green verification banner at top when isHomeAffairsVerified
Red flag banner when isAccountFlagged
Step 6: Add nudge banner to home screen
File: app/(tabs)/index.tsx

Add isProfileComplete, isAccountFlagged from useAuth()
Add nudgeDismissed state (resets on remount, matching web session behavior)
Render amber banner between welcome card and HealthScoreCard when !isProfileComplete && !isAccountFlagged && !nudgeDismissed
"Complete now" CTA → router.push('/edit-profile')
Dismiss button → setNudgeDismissed(true)
Step 7: Update HealthScoreGauge scoring
File: components/HealthScoreGauge.tsx

In useMilestones():

Add isHomeAffairsVerified check from userProfile.identityVerification.status
Change Personal details points: points: isHomeAffairsVerified ? 10 : 5
Add new milestone: { label: 'ID verified by Home Affairs', points: 5, completed: isHomeAffairsVerified }
Verification
Run the app: npx expo start --clear
Test incomplete profile: Register a new user → tap any product apply screen → should redirect to edit-profile
Test nudge banner: Home screen should show amber "Complete your profile" banner
Test profile save with ID: Enter a valid SA ID in edit-profile → save → should trigger Home Affairs verification → on match, fields lock
Test name mismatch: Enter mismatched names → save → should show alert / flag account
Test ProfileGuard after completion: Fill all required fields → product apply screens should render normally
Test returnTo flow: Tap credit-apply (incomplete) → redirected to edit-profile → complete + save → should return to credit-apply
Test HealthScoreGauge: Verified profile should show 10 pts for Personal Details; unverified shows 5
