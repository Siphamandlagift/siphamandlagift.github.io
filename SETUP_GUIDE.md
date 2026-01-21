# SkillsConnect LMS - Setup & Usage Guide

## ✅ System is Now LIVE and FUNCTIONAL

Your SkillsConnect LMS is now fully operational with local storage on your PC!

---

## 📋 Getting Started

### Test Accounts (Pre-configured)

| Username | Password | Role | Purpose |
|----------|----------|------|---------|
| admin | admin | Administrator | Full system access |
| jane | jane | Training Manager | Create courses, manage assignments |
| alice | alice | Student | Enrolled in courses |
| bob | bob | Student | Enrolled in courses |

### How to Login

1. Open your LMS in a browser
2. You'll see the login modal automatically
3. Enter any test account credentials above
4. Select the matching role
5. Click "Sign In"

---

## 💾 Data Storage

**Location:** Browser's Local Storage (on your PC)  
**Data Stored:**
- ✓ User accounts and profiles
- ✓ Courses created
- ✓ Programmes
- ✓ Student enrollments
- ✓ Assignments
- ✓ Grades
- ✓ Certificates
- ✓ Badges

**Persistence:** Data remains even after closing the browser (until cache is cleared)

---

## 👥 Administrator Functions

### Login as: admin / admin

**Dashboard:**
- View total courses
- View total students
- View system statistics

**User Management:**
- Add new users manually
- View all users in table
- Edit/delete users
- Bulk upload users via CSV

**Features Available:**
- User Management
- Course Content Overview
- Reports
- System Settings
- Certificates Management
- Badges Management

---

## 👨‍🏫 Training Manager Functions

### Login as: jane / jane

**Dashboard:**
- View your courses
- View programmes
- Manage students

**Available Features:**
- My Courses (view/edit courses you created)
- Programme Management (create learning programmes)
- Course Overview
- Assign Students (link students to programmes)
- Assignments (create and manage)
- Gradebook (grade students)
- Certificate Templates
- Manage Badges

**Create a Course:**
1. Go to "Course Content Overview"
2. Create a new course
3. Add sections and content
4. Save

**Create an Assignment:**
1. Go to "Assignments"
2. Click "Create Assignment"
3. Select student
4. Add title, due date, instructions
5. Set total marks
6. Click "Create & Assign"

---

## 👨‍🎓 Student Functions

### Login as: alice / alice or bob / bob

**Dashboard:**
- View enrolled courses
- Total hours spent
- Badges earned

**Available Features:**
- My Courses (view enrolled courses)
- Assignments (view assigned tasks)
- My Grades (view grades/scores)
- My Certificates (earned certificates)
- My Badges (earned badges)

**View Assignment:**
1. Go to "Assignments"
2. Click on any assignment
3. View instructions
4. Submit when done

---

## 📊 Key Features

### 1. **User Management**
- Add users one by one
- Bulk upload via CSV file
- Delete users
- Assign roles (Admin, Manager, Student)

### 2. **Course Management**
- Create courses with sections
- Add multimedia content
- Track student progress
- View course analytics

### 3. **Programmes**
- Create learning programmes
- Link multiple courses
- Assign students to programmes
- Track programme completion

### 4. **Assignments**
- Create assignments for students
- Set due dates
- Attach documents
- Track submissions
- Grade work

### 5. **Gradebook**
- View student grades
- Update grades
- Generate reports
- Export grade data

### 6. **Certificates**
- Award certificates upon completion
- Custom certificate design
- Download certificates
- Track earned certificates

### 7. **Badges**
- Create achievement badges
- Award for milestones
- Track badge earnings
- View badge details

---

## 🎯 Typical Workflow

### For Managers:

```
1. Create Courses
   ↓
2. Create Programmes (link courses)
   ↓
3. Assign Students to Programmes
   ↓
4. Create Assignments for Students
   ↓
5. View Student Progress
   ↓
6. Grade Submissions
   ↓
7. Award Certificates/Badges
```

### For Students:

```
1. Receive Course Enrollment
   ↓
2. View My Courses
   ↓
3. Complete Course Content
   ↓
4. View Assignments
   ↓
5. Submit Work
   ↓
6. Check Grades
   ↓
7. View Certificates & Badges
```

---

## 💡 Tips & Tricks

### Bulk Upload CSV Format
```csv
name,email,idNumber,company,role,password
John Doe,john@company.com,EMP001,TechCorp,student,password123
Jane Smith,jane@company.com,EMP002,TechCorp,training_manager,password456
```

### Data Backup
Your data is stored in browser's localStorage. To backup:
1. Open Browser DevTools (F12)
2. Go to Application/Storage
3. Click Local Storage
4. Export all data

### Clear All Data
If you want to start fresh:
1. Press F12 to open DevTools
2. Go to Application → Local Storage
3. Delete all entries
4. Refresh the page

---

## 🚀 What Works Now

✅ User Authentication  
✅ Role-Based Access Control  
✅ User Management  
✅ Course Creation & Management  
✅ Programme Management  
✅ Student Assignment  
✅ Assignment Creation & Management  
✅ Grading System  
✅ Dashboard Statistics  
✅ Responsive Design  
✅ Modern UI/UX  
✅ Data Persistence  
✅ Mobile Support  

---

## 📝 Common Tasks

### Add a New Student
1. Login as admin
2. Go to "User Management"
3. Click "+ Add User"
4. Fill in details
5. Select "Student" as role
6. Click "Add User"

### Create a Course
1. Login as training_manager (jane)
2. Go to "Course Content Overview"
3. Click "Create New Course"
4. Enter course name and description
5. Click "Create Course"

### Assign Course to Student
1. Go to "Programme Management"
2. Create a programme (link course)
3. Go to "Assign Students"
4. Select programme and students
5. Click "Save Assignments"

### Grade a Student
1. Go to "Gradebook"
2. Find student row
3. Click "Grade" button
4. Enter marks
5. Save

---

## 🎨 UI Customization Notes

All data is stored with the account in localStorage:
- Student progress is tracked per student ID
- Grades are linked to student assignments
- Certificates are issued per course completion
- Badges are awarded for achievements

---

## 📞 Troubleshooting

### Login Not Working
- Check username/password spelling
- Ensure role matches (see test accounts)
- Clear browser cache and try again

### Data Not Saving
- Check if localStorage is enabled
- Try a different browser
- Check browser storage quota

### Can't See My Courses
- Make sure you're logged in as correct role
- Check if you're assigned to the course
- Verify enrollment status

---

## Next Steps

1. **Try all test accounts** to see different user experiences
2. **Create some sample data** (courses, students, assignments)
3. **Test the workflow** - create, assign, grade
4. **Explore all sections** to familiarize yourself
5. **Read the UI tooltips** for more information

---

## Future Enhancements (Optional)

When ready to upgrade from local storage:
- Database backend (MySQL, MongoDB, PostgreSQL)
- Cloud storage for files
- Email notifications
- Real-time collaboration
- Advanced analytics
- API integration

---

## Support

Your system is ready to use! All features are functional with local storage.

**Data Location:** Browser's Local Storage  
**Capacity:** ~5-10MB per domain  
**Duration:** Until cache is cleared  

Enjoy your fully functional SkillsConnect LMS! 🎓✨
