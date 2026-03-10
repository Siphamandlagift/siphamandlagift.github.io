function getDefaultUsers() {
            return [
            // Dummy Administrator
            {
                id: 1,
                name: 'Admin',
                surname: 'User',
                email: 'admin@skillsconnect.com',
                idNumber: 'ADM001',
                company: 'SkillsConnect',
                role: 'administrator',
                picture: 'https://placehold.co/40x40/FF5733/FFFFFF?text=AU',
                status: 'active',
                enrollmentDate: '2023-01-01',
                endDate: null,
                coursesEnrolled: [],
                totalHoursSpent: 0
            },
            // Dummy Training Manager (formerly Teacher)
            {
                id: 2,
                name: 'Jane',
                surname: 'Trainer',
                email: 'jane.trainer@skillsconnect.com',
                idNumber: 'TRM001',
                company: 'SkillsConnect',
                role: 'training_manager',
                picture: 'https://placehold.co/40x40/5DADE2/FFFFFF?text=JT',
                status: 'active',
                enrollmentDate: '2023-02-15',
                endDate: null,
                coursesEnrolled: [],
                totalHoursSpent: 0
            },
            // Dummy Students
            {
                id: 3,
                name: 'Alice',
                surname: 'Johnson',
                email: 'alice@skillsconnect.com',
                idNumber: 'STD001',
                company: 'Global Corp',
                role: 'student',
                picture: 'https://placehold.co/40x40/F1C40F/FFFFFF?text=AJ',
                status: 'active',
                enrollmentDate: '2023-03-01',
                endDate: null,
                coursesEnrolled: [
                    { courseId: 101, enrollmentDate: '2023-03-01', completionDate: null, hoursSpent: 25 },
                    { courseId: 102, enrollmentDate: '2023-04-10', completionDate: '2023-06-20', hoursSpent: 40 }
                ],
                totalHoursSpent: 65
            },
            {
                id: 4,
                name: 'Bob',
                surname: 'Smith',
                email: 'bob@skillsconnect.com',
                idNumber: 'STD002',
                company: 'Local Business',
                role: 'student',
                picture: 'https://placehold.co/40x40/FF6347/FFFFFF?text=BS',
                status: 'active',
                enrollmentDate: '2023-03-05',
                endDate: null,
                coursesEnrolled: [
                    { courseId: 101, enrollmentDate: '2023-03-05', completionDate: '2023-05-15', hoursSpent: 30 }
                ],
                totalHoursSpent: 30
            },
            {
                id: 5,
                name: 'Charlie',
                surname: 'Brown',
                email: 'charlie@skillsconnect.com',
                idNumber: 'STD003',
                company: 'Tech Solutions',
                role: 'student',
                picture: 'https://placehold.co/40x40/9B59B6/FFFFFF?text=CB',
                status: 'active',
                enrollmentDate: '2023-04-10',
                endDate: null,
                coursesEnrolled: [],
                totalHoursSpent: 0
            },
            {
                id: 6,
                name: 'Diana',
                surname: 'Prince',
                email: 'diana@skillsconnect.com',
                idNumber: 'STD004',
                company: 'Innovation Hub',
                role: 'student',
                picture: 'https://placehold.co/40x40/E74C3C/FFFFFF?text=DP',
                status: 'active',
                enrollmentDate: '2023-04-15',
                endDate: null,
                coursesEnrolled: [],
                totalHoursSpent: 0
            },
            {
                id: 7,
                name: 'Ethan',
                surname: 'Hunt',
                email: 'ethan@skillsconnect.com',
                idNumber: 'STD005',
                company: 'Global Corp',
                role: 'student',
                picture: 'https://placehold.co/40x40/3498DB/FFFFFF?text=EH',
                status: 'active',
                enrollmentDate: '2023-04-20',
                endDate: null,
                coursesEnrolled: [],
                totalHoursSpent: 0
            },
            {
                id: 8,
                name: 'Fiona',
                surname: 'Clark',
                email: 'fiona@skillsconnect.com',
                idNumber: 'STD006',
                company: 'Local Business',
                role: 'student',
                picture: 'https://placehold.co/40x40/1ABC9C/FFFFFF?text=FC',
                status: 'active',
                enrollmentDate: '2023-05-01',
                endDate: null,
                coursesEnrolled: [],
                totalHoursSpent: 0
            }
        ];
        }

function getDefaultCourses() {
            return [
            {
                id: 101,
                name: 'Induction Programme',
                description: 'Welcome to our company! Learn about our mission, values, policies, and get started on your journey with us.',
                videoFileName: 'company_induction.mp4',
                pdfFileName: 'induction_handbook.pdf',
                picture: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
                sections: [
                    {
                        id: 1011,
                        title: "Welcome to the Team",
                        videoDuration: "8 minutes",
                        questions: [
                            {
                                id: 1,
                                type: 'multiple-choice',
                                question: 'Which of the following is one of our core company values?',
                                options: ['Integrity', 'Deception', 'Indifference', 'Carelessness'],
                                correctAnswer: 0,
                                marks: 5
                            },
                            {
                                id: 2,
                                type: 'true-false',
                                question: 'Company induction is mandatory for all new employees.',
                                correctAnswer: true,
                                marks: 5
                            }
                        ]
                    },
                    {
                        id: 1012,
                        title: "Company Policies and Procedures",
                        videoDuration: "15 minutes",
                        questions: [
                            {
                                id: 3,
                                type: 'multiple-choice',
                                question: 'What should you do if you witness a workplace violation?',
                                options: ['Ignore it', 'Report it to management or HR', 'Handle it yourself', 'Tell your colleagues'],
                                correctAnswer: 1,
                                marks: 10
                            },
                            {
                                id: 4,
                                type: 'true-false',
                                question: 'Punctuality is important in our company culture.',
                                correctAnswer: true,
                                marks: 5
                            }
                        ]
                    },
                    {
                        id: 1013,
                        title: "Employee Benefits and Support",
                        videoDuration: "12 minutes",
                        questions: [
                            {
                                id: 5,
                                type: 'multiple-choice',
                                question: 'Which of the following is typically included in employee benefits?',
                                options: ['Health insurance', 'Free meals', 'Personal car', 'All of the above'],
                                correctAnswer: 0,
                                marks: 10
                            }
                        ]
                    }
                ],
                questions: [
                    { type: 'multiple-choice', text: 'Which of the following is one of our core company values?', options: ['Integrity', 'Deception', 'Indifference', 'Carelessness'], correctAnswer: 0, marks: 5 },
                    { type: 'true-false', text: 'Company induction is mandatory for all new employees.', correctAnswer: true, marks: 5 },
                    { type: 'multiple-choice', text: 'What should you do if you witness a workplace violation?', options: ['Ignore it', 'Report it to management or HR', 'Handle it yourself', 'Tell your colleagues'], correctAnswer: 1, marks: 10 }
                ],
                documents: [
                    {
                        id: 1001,
                        title: 'Company Induction Presentation',
                        type: 'ppt',
                        fileName: 'company_induction.ppt',
                        description: 'PowerPoint presentation covering company overview, mission, values, and initial onboarding steps.',
                        icon: 'las la-file-powerpoint',
                        color: 'orange',
                        isRead: false,
                        createdDate: '2024-01-10',
                        fileSize: '3.5 MB'
                    },
                    {
                        id: 1002,
                        title: 'Company Policies & Procedures',
                        type: 'pdf',
                        fileName: 'company_policies.pdf',
                        description: 'Comprehensive PDF document outlining all company policies, code of conduct, and operational procedures.',
                        icon: 'las la-file-pdf',
                        color: 'red',
                        isRead: false,
                        createdDate: '2024-01-10',
                        fileSize: '2.1 MB'
                    },
                    {
                        id: 1003,
                        title: 'Employee Handbook',
                        type: 'pdf',
                        fileName: 'employee_handbook.pdf',
                        description: 'Complete employee handbook with benefits, leave policies, and workplace expectations.',
                        icon: 'las la-file-pdf',
                        color: 'red',
                        isRead: false,
                        createdDate: '2024-01-10',
                        fileSize: '1.8 MB'
                    }
                ],
                readStatus: false,
                creatorId: 2
            },
            {
                id: 102,
                name: 'Data Science Fundamentals',
                description: 'Explore data analysis, machine learning, and statistical modeling to make data-driven decisions.',
                videoFileName: 'data_science_intro.mp4',
                pdfFileName: 'data_science_guide.pdf',
                picture: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
                sections: [
                    {
                        id: 1021,
                        title: "Introduction to Data Science",
                        videoDuration: "10 minutes",
                        questions: [
                            {
                                id: 1,
                                type: 'multiple-choice',
                                question: 'What is the primary goal of data science?',
                                options: ['To collect data', 'To extract insights from data', 'To store data', 'To ignore data'],
                                correctAnswer: 1,
                                marks: 10
                            },
                            {
                                id: 2,
                                type: 'true-false',
                                question: 'Python is commonly used in data science.',
                                correctAnswer: true,
                                marks: 5
                            }
                        ]
                    },
                    {
                        id: 1022,
                        title: "Data Analysis Basics",
                        videoDuration: "14 minutes",
                        questions: [
                            {
                                id: 3,
                                type: 'multiple-choice',
                                question: 'Which language is commonly used in data science?',
                                options: ['Java', 'Python', 'C++'],
                                correctAnswer: 1,
                                marks: 10
                            },
                            {
                                id: 4,
                                type: 'true-false',
                                question: 'Statistics is an important part of data analysis.',
                                correctAnswer: true,
                                marks: 5
                            }
                        ]
                    },
                    {
                        id: 1023,
                        title: "Machine Learning Introduction",
                        videoDuration: "16 minutes",
                        questions: [
                            {
                                id: 5,
                                type: 'multiple-choice',
                                question: 'What does ML stand for in the context of data science?',
                                options: ['Maximum Learning', 'Machine Learning', 'Multiple Logic', 'Model Language'],
                                correctAnswer: 1,
                                marks: 10
                            }
                        ]
                    }
                ],
                questions: [
                    { type: 'multiple-choice', text: 'Which language is commonly used in data science?', options: ['Java', 'Python', 'C++'], correctAnswer: 1, marks: 10 },
                    { type: 'true-false', text: 'Statistics is important in data analysis.', correctAnswer: true, marks: 5 },
                    { type: 'multiple-choice', text: 'What does ML stand for?', options: ['Maximum Learning', 'Machine Learning', 'Multiple Logic'], correctAnswer: 1, marks: 10 }
                ],
                documents: [
                    {
                        id: 2001,
                        title: 'Data Science Fundamentals Guide',
                        type: 'ppt',
                        fileName: 'data_science_guide.ppt',
                        description: 'Comprehensive PowerPoint guide introducing data science concepts, tools, and best practices.',
                        icon: 'las la-file-powerpoint',
                        color: 'orange',
                        isRead: false,
                        createdDate: '2024-01-15',
                        fileSize: '4.2 MB'
                    },
                    {
                        id: 2002,
                        title: 'Data Safety & Privacy Policy',
                        type: 'pdf',
                        fileName: 'data_safety_policy.pdf',
                        description: 'Important PDF document on data safety, privacy regulations, and compliance requirements.',
                        icon: 'las la-file-pdf',
                        color: 'red',
                        isRead: false,
                        createdDate: '2024-01-15',
                        fileSize: '2.5 MB'
                    }
                ],
                readStatus: false,
                creatorId: 2
            },
            {
                id: 103,
                name: 'Advanced Algorithms',
                description: 'Master complex algorithms and data structures for optimized problem-solving and efficient code.',
                videoFileName: 'advanced_algo.mp4',
                pdfFileName: 'algo_handbook.pdf',
                picture: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
                sections: [
                    {
                        id: 1031,
                        title: "Algorithm Fundamentals",
                        videoDuration: "12 minutes",
                        questions: [
                            {
                                id: 1,
                                type: 'multiple-choice',
                                question: 'What does Big O notation describe?',
                                options: ['Algorithm efficiency', 'Program size', 'Memory location', 'Variable name'],
                                correctAnswer: 0,
                                marks: 10
                            },
                            {
                                id: 2,
                                type: 'true-false',
                                question: 'Big O notation describes the efficiency of an algorithm.',
                                correctAnswer: true,
                                marks: 5
                            }
                        ]
                    },
                    {
                        id: 1032,
                        title: "Data Structures",
                        videoDuration: "18 minutes",
                        questions: [
                            {
                                id: 3,
                                type: 'multiple-choice',
                                question: 'Which data structure uses LIFO (Last In First Out)?',
                                options: ['Queue', 'Stack', 'Array', 'Tree'],
                                correctAnswer: 1,
                                marks: 10
                            },
                            {
                                id: 4,
                                type: 'true-false',
                                question: 'Arrays provide O(1) access time to any element.',
                                correctAnswer: true,
                                marks: 5
                            }
                        ]
                    },
                    {
                        id: 1033,
                        title: "Sorting and Searching",
                        videoDuration: "20 minutes",
                        questions: [
                            {
                                id: 5,
                                type: 'multiple-choice',
                                question: 'Which sorting algorithm has the best average case time complexity?',
                                options: ['Bubble Sort', 'Quick Sort', 'Insertion Sort', 'Selection Sort'],
                                correctAnswer: 1,
                                marks: 15
                            }
                        ]
                    }
                ],
                questions: [
                    { type: 'true-false', text: 'Big O notation describes the efficiency of an algorithm.', correctAnswer: true, marks: 15 },
                    { type: 'multiple-choice', text: 'Which data structure uses LIFO?', options: ['Queue', 'Stack', 'Array'], correctAnswer: 1, marks: 10 },
                    { type: 'multiple-choice', text: 'Which sorting algorithm has the best average case?', options: ['Bubble Sort', 'Quick Sort', 'Insertion Sort'], correctAnswer: 1, marks: 15 }
                ],
                documents: [
                    {
                        id: 3001,
                        title: 'Algorithm Design Guide',
                        type: 'ppt',
                        fileName: 'algorithms_design.ppt',
                        description: 'PowerPoint covering algorithm design paradigms, Big O analysis, and optimization techniques.',
                        icon: 'las la-file-powerpoint',
                        color: 'orange',
                        isRead: false,
                        createdDate: '2024-01-20',
                        fileSize: '5.1 MB'
                    },
                    {
                        id: 3002,
                        title: 'Code of Conduct & Ethics',
                        type: 'pdf',
                        fileName: 'code_of_conduct.pdf',
                        description: 'PDF document covering ethical programming practices and professional conduct guidelines.',
                        icon: 'las la-file-pdf',
                        color: 'red',
                        isRead: false,
                        createdDate: '2024-01-20',
                        fileSize: '1.9 MB'
                    }
                ],
                readStatus: false,
                creatorId: 2
            }
        ];
        }

function getDefaultAssignments() {
            return [
                {
                    id: Date.now(),
                    title: 'Health and Safety Case Study - TechNow Solutions',
                    instructions: 'Read the comprehensive case study about a fire incident at TechNow Solutions and complete all 8 questions. This assignment tests your understanding of workplace health and safety principles including hazard identification, risk assessment, and control measures implementation.',
                    dueDate: '2026-02-21',
                    documentFileName: 'Health-Safety-Case-Study.html',
                    documentFileUrl: 'health-safety-assignment.html',
                    totalMarks: 100,
                    assignedStudentId: 3,
                    creatorId: 1,
                    status: 'Assigned',
                    submissionDate: null,
                    creationDate: '2026-01-21'
                }
            ];
        }

function getDefaultCertificates() {
            return [
            // Certificates for completed courses
            {
                id: 'CERT-001',
                studentId: 4,
                studentName: 'Bob',
                courseId: 101,
                courseName: 'Introduction to Web Development',
                issueDate: '2023-05-15',
                certificateType: 'Course Completion',
                status: 'Active'
            },
            {
                id: 'CERT-002',
                studentId: 3,
                studentName: 'Alice',
                courseId: 102,
                courseName: 'Data Science Fundamentals',
                issueDate: '2023-06-20',
                certificateType: 'Course Completion',
                status: 'Active'
            }
        ];
        }

function getDefaultBadges() {
            return [
            {
                id: 1,
                name: 'Quick Learner',
                hoursRequired: 5,
                description: 'Completed 5 hours of learning',
                icon: '🚀',
                creatorId: 1,
                createdDate: '2024-01-01',
                timesEarned: 0
            },
            {
                id: 2,
                name: 'Dedicated Scholar',
                hoursRequired: 25,
                description: 'Completed 25 hours of learning',
                icon: '📚',
                creatorId: 1,
                createdDate: '2024-01-01',
                timesEarned: 0
            },
            {
                id: 3,
                name: 'Learning Champion',
                hoursRequired: 50,
                description: 'Completed 50 hours of learning',
                icon: '🏆',
                creatorId: 1,
                createdDate: '2024-01-01',
                timesEarned: 0
            }
        ];
        }

// --- State Management --- 

// Global Application State Arrays
let allUsersData = [];
let allCoursesData = [];
let allProgramsData = [];
let allAssignmentsData = [];
let allCertificatesData = [];
let allBadgesData = [];
let allLearnerGroups = [];
let calendarEvents = [];
let studentNotifications = [];
let studentBadgesData = [];


function saveToLocalStorage() {
            try {
                localStorage.setItem('allUsersData', JSON.stringify(allUsersData));
                localStorage.setItem('allCoursesData', JSON.stringify(allCoursesData));
                localStorage.setItem('allProgramsData', JSON.stringify(allProgramsData));
                localStorage.setItem('allAssignmentsData', JSON.stringify(allAssignmentsData));
                localStorage.setItem('allCertificatesData', JSON.stringify(allCertificatesData));
                localStorage.setItem('allBadgesData', JSON.stringify(allBadgesData));
                localStorage.setItem('studentBadgesData', JSON.stringify(studentBadgesData));
                localStorage.setItem('documentRollouts', JSON.stringify(documentRollouts));
                localStorage.setItem('studentNotifications', JSON.stringify(studentNotifications));
                localStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
                localStorage.setItem('allLearnerGroups', JSON.stringify(allLearnerGroups));
                console.log('Data saved to localStorage successfully');
            } catch (error) {
                console.error('Error saving to localStorage:', error);
            }
        }

function loadFromLocalStorage() {
            try {
                const users = localStorage.getItem('allUsersData');
                const courses = localStorage.getItem('allCoursesData');
                const programs = localStorage.getItem('allProgramsData');
                const assignments = localStorage.getItem('allAssignmentsData');
                const certificates = localStorage.getItem('allCertificatesData');
                const badges = localStorage.getItem('allBadgesData');
                const studentBadges = localStorage.getItem('studentBadgesData');
                const rollouts = localStorage.getItem('documentRollouts');
                const notifications = localStorage.getItem('studentNotifications');
                const savedUser = localStorage.getItem('loggedInUser');

                                  const savedGroups = localStorage.getItem('allLearnerGroups');
                  if (savedGroups) allLearnerGroups = JSON.parse(savedGroups);
                  if (users) allUsersData = JSON.parse(users);
                if (courses) allCoursesData = JSON.parse(courses);
                if (programs) allProgramsData = JSON.parse(programs);
                if (assignments) allAssignmentsData = JSON.parse(assignments);
                if (certificates) allCertificatesData = JSON.parse(certificates);
                if (badges) allBadgesData = JSON.parse(badges);
                if (studentBadges) studentBadgesData = JSON.parse(studentBadges);
                if (rollouts) documentRollouts = JSON.parse(rollouts);
                if (notifications) studentNotifications = JSON.parse(notifications);
                if (savedUser) {
                    const parsedUser = JSON.parse(savedUser);
                    // Only restore user if they have an id (logged in)
                    if (parsedUser && parsedUser.id) {
                        loggedInUser = parsedUser;
                    }
                }

                console.log('Data loaded from localStorage successfully');
                return true;
            } catch (error) {
                console.error('Error loading from localStorage:', error);
                return false;
            }
        }

function initializeData() {
            const loaded = loadFromLocalStorage();
            
            // If nothing in localStorage, populate with default data
            if (!loaded || allUsersData.length === 0) {
                console.log('No data in localStorage, using default dummy data');
                initializeDefaultData();
                saveToLocalStorage();
            } else {
                // Ensure default users (especially students) exist even if localStorage has data
                ensureDefaultStudentsExist();
            }
        }

function initializeDefaultData() {
            allUsersData = getDefaultUsers();
            allCoursesData = getDefaultCourses();
            allProgramsData = [];
            allAssignmentsData = getDefaultAssignments();
            allCertificatesData = getDefaultCertificates();
            allBadgesData = getDefaultBadges();
        }