# Qualification System Implementation

## Overview
This implementation adds a complete qualification management system to the Student Worker Scheduling System, allowing managers to view student qualifications and enforce qualification requirements when assigning students to shifts.

## Files Created/Modified

### Database Migrations
- `migrations/20250303000001-create-positions.js` - Creates positions table
- `migrations/20250303000002-create-qualifications.js` - Creates qualifications table  
- `migrations/20250303000003-create-user-qualifications.js` - Creates user_qualifications junction table
- `migrations/20250303000004-create-position-qualifications.js` - Creates position_qualifications junction table
- `migrations/20250303000005-add-role-to-users.js` - Adds role field to users table

### Models
- `app/models/position.model.js` - Position model
- `app/models/qualification.model.js` - Qualification model
- `app/models/userQualification.model.js` - UserQualification model
- `app/models/positionQualification.model.js` - PositionQualification model
- `app/models/user.model.js` - Updated to include role field
- `app/models/index.js` - Updated with new models and associations

### Authorization
- `app/authorization/roleAuth.js` - Role-based authorization middleware

### Controllers
- `app/controllers/qualification.controller.js` - Qualification management endpoints
- `app/controllers/shift.controller.js` - Updated with qualification validation for shift assignment

### Routes
- `app/routes/qualification.routes.js` - Qualification API routes
- `app/routes/shift.routes.js` - Updated (removed dedicated assign route)
- `app/routes/index.js` - Updated to include qualification routes

### Tests
- `__tests__/helpers/testData.js` - Test data fixtures and helpers
- `__tests__/controllers/qualification.controller.tests.js` - Qualification endpoint tests
- `__tests__/controllers/shiftAssignment.tests.js` - Shift assignment validation tests
- `__tests__/setup.js` - Jest test setup
- `jest.config.js` - Jest configuration

## Database Schema

### Tables Created

#### positions
- position_id (PK)
- position_name
- description
- department_id (FK)
- created_at, updated_at

#### qualifications
- qualification_id (PK)
- qualification_name (unique)
- description
- requires_document (boolean)
- created_at, updated_at

#### user_qualifications
- user_qualification_id (PK)
- user_id (FK)
- qualification_id (FK)
- approval_status (ENUM: PENDING, APPROVED, REJECTED)
- approved_by_user_id (nullable FK)
- approved_at (nullable datetime)
- document_name, document_path
- created_at, updated_at

#### position_qualifications
- position_qualification_id (PK)
- position_id (FK)
- qualification_id (FK)
- created_at, updated_at

### Modified Tables
#### users
- Added role field (ENUM: student, manager, admin)

## API Endpoints

### Qualification Endpoints
- `GET /students/qualifications` - Manager only: Get all students with qualifications
- `GET /students/:userId/qualifications` - Manager only: Get qualifications for specific student
- `GET /positions/:positionId/required-qualifications` - Manager only: Get position requirements
- `GET /qualifications` - Authenticated: Get all available qualifications
- `POST /qualifications/check` - Manager only: Check if user meets position requirements

### Shift Assignment (Enhanced)
- `PUT /shifts/:id` - Authenticated: Update shift (includes qualification validation when assigning user)

## Running Commands

### Database Migrations
```bash
# Run all migrations
npm run migrate

# Or run individual migrations if needed
npx sequelize-cli db:migrate --migrations-path ./migrations
```

### Backend Tests
```bash
# Run all tests
npm test

# Run specific test files
npm test -- qualification.controller.tests.js
npm test -- shiftAssignment.tests.js

# Run with coverage
npm test -- --coverage
```

### Frontend Tests
```bash
cd ../StudentWrkSchedulingSystem-frontend
npm test
```

## Acceptance Criteria Test Mapping

| AC | Description | Test Name | Location |
|----|-------------|-----------|----------|
| AC1 | Manager can view students and their qualifications | "Manager can view students and their qualifications" | qualification.controller.tests.js |
| AC2 | Non-manager cannot access student qualifications | "Non-manager cannot access student qualifications" | qualification.controller.tests.js |
| AC3 | Manager can view single student qualifications | "Manager can view single student qualifications" | qualification.controller.tests.js |
| AC4 | Student with no qualifications returns empty list | "Student with no qualifications returns empty list" | qualification.controller.tests.js |
| AC5 | Position returns required qualifications | "Position required qualifications endpoint returns expected list" | qualification.controller.tests.js |
| AC6 | Assigning user to shift succeeds when qualified | "Assign shift succeeds when user has all required qualifications approved" | shiftAssignment.tests.js |
| AC7 | Assigning user to shift fails if missing qualification | "Assign shift fails when user missing required qualification" | shiftAssignment.tests.js |
| AC8 | Assigning user requires ALL position qualifications | "Assign shift requires ALL qualifications (multiple required quals)" | shiftAssignment.tests.js |
| AC9 | Assigning user fails if qualification not approved | "Assign shift fails if required qualification is not approved" | shiftAssignment.tests.js |

## Security Features

### Role-Based Access Control
- Manager/Admin required for qualification viewing endpoints
- Student role enforced for shift assignments
- Token-based authentication with session validation

### Input Validation
- All required fields validated
- Proper error responses for missing data
- SQL injection prevention via Sequelize ORM

### Data Integrity
- Foreign key constraints ensure referential integrity
- Unique constraints prevent duplicate qualifications
- ENUM constraints limit valid status values

## Frontend Integration

The frontend is already wired to use the correct API endpoints:
- `qualificationService.getStudentsWithQualifications()` → `GET /students/qualifications`
- `qualificationService.getStudentQualifications()` → `GET /students/:userId/qualifications`
- `qualificationService.getPositionRequiredQualifications()` → `GET /positions/:positionId/required-qualifications`
- `qualificationService.getAllQualifications()` → `GET /qualifications`
- `shiftService.updateShift()` → `PUT /shifts/:id` (with qualification validation)

## Error Handling

### HTTP Status Codes
- 200: Success
- 400: Bad Request (validation errors, missing qualifications)
- 401: Unauthorized (invalid/missing token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found (resource doesn't exist)
- 500: Internal Server Error

### Error Response Format
```json
{
  "message": "Human-readable error description",
  "missingQualifications": [...], // For assignment failures
  "notApprovedQualifications": [...] // For approval status issues
}
```

## Performance Considerations

### Database Indexes
- Foreign key columns indexed for fast joins
- Unique constraints on qualification names
- Composite indexes on junction tables

### Query Optimization
- Eager loading with Sequelize includes
- Efficient qualification validation logic
- Minimal database round trips

## Future Enhancements

### Potential Improvements
1. Document upload/storage for qualification proof
2. Qualification expiration tracking
3. Bulk qualification assignment
4. Qualification categories/grouping
5. Audit trail for qualification changes
6. Email notifications for qualification status changes

### Scalability
- Database connection pooling
- Caching for frequently accessed qualification data
- Pagination for large student/qualification lists
