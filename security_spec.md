# Firebase Security Specification - Maintenance SC Pro

## Data Invariants
1. A **WorkOrder** must reference a valid **Asset** in the `/assets` collection.
2. A **WorkOrder** must be assigned to at least one technician from the `/users` collection (where role is TECHNICIAN).
3. The `role` of a **User** can only be modified by an **ADMIN**.
4. **Assets** can only be created or modified by an **ADMIN**.
5. **WorkOrders** can be created by **ADMIN**s and updated by both **ADMIN**s and assigned **TECHNICIAN**s (assigned technicians can only update status and tasks).

## The "Dirty Dozen" Payloads (Security Rejection Tests)

1. **Payload**: User tries to set themselves as ADMIN during registration.
   - `match /users/{userId}`: `allow create: if request.auth.uid == userId && request.resource.data.role == 'TECHNICIAN'` (or similar guard).
2. **Payload**: Non-admin tries to create an Asset.
   - `match /assets/{assetId}`: `allow create: if isAdmin()`.
3. **Payload**: Technician tries to delete a WorkOrder.
   - `match /orders/{orderId}`: `allow delete: if isAdmin()`.
4. **Payload**: User tries to update an Asset's serialNumber (immutable field for techs).
   - `match /assets/{assetId}`: `allow update: if isAdmin()`.
5. **Payload**: Technician tries to update a WorkOrder they are NOT assigned to.
   - `match /orders/{orderId}`: `allow update: if isAdmin() || isAssignedTech()`.
6. **Payload**: User tries to write to a "Ghost Field" on User profile (e.g., `isVerified: true`).
   - `isValidUser` helper with `affectedKeys().hasOnly()`.
7. **Payload**: Asset creation with an extremely large description (1MB+) to cause "Denial of Wallet".
   - `description.size() < 1000`.
8. **Payload**: WorkOrder update with invalid priority (e.g., "URGENTE" instead of "ALTA").
   - Enum validation in `isValidWorkOrder`.
9. **Payload**: spoofing `createdAt` timestamp using client clock.
   - `request.resource.data.createdAt == request.time`.
10. **Payload**: Changing `ownerId` or `creatorId` of a resource during update.
    - `incoming().creatorId == existing().creatorId`.
11. **Payload**: Anonymous user trying to read Assets.
    - `allow read: if isSignedIn()`.
12. **Payload**: Listing all users without being authenticated.
    - `allow list: if isSignedIn()`.

## Test Runner Plan
I will create `firestore.rules.test.ts` to verify these constraints.
