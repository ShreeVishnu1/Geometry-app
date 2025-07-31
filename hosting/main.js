import './style.css';

// --- App Initialization (Wrapped in DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', () => {
    // The base URL for our new backend server.
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

    // DOM Elements
    const pages = document.querySelectorAll('.page');
    const loadingSpinner = document.getElementById('loading-spinner');
    const authError = document.getElementById('auth-error');

    // State
    let currentUser = null;
    let studentData = null;
    let studentChartInstance = null;
    let adminChartInstance = null;

    // --- Assessment Questions ---
    const preAssessmentQuestions = [
        { question: "How many sides does a triangle have?", options: ["2", "3", "4", "5"], answer: "3" },
        { question: "Which shape is perfectly round?", options: ["Square", "Circle", "Rectangle", "Star"], answer: "Circle" },
        { question: "A square has four equal sides. True or False?", options: ["True", "False"], answer: "True" },
        { question: "How many corners does a rectangle have?", options: ["3", "4", "5", "6"], answer: "4" },
        { question: "Which of these is NOT a 2D shape?", options: ["Triangle", "Cube", "Circle", "Square"], answer: "Cube" }
    ];
    let finalAssessmentQuestions = [];

    // --- Page Navigation ---
    function showPage(pageId) {
        pages.forEach(page => {
            page.classList.toggle('active', page.id === pageId);
        });
        loadingSpinner.style.display = 'none';
    }

    // --- UI Rendering ---
    function renderAssessment(containerId, questions) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        questions.forEach((q, index) => {
            const questionEl = document.createElement('div');
            questionEl.className = 'mb-6';
            questionEl.innerHTML = `<p class="font-semibold mb-2">${index + 1}. ${q.question}</p>`;
            
            const optionsEl = document.createElement('div');
            optionsEl.dataset.questionIndex = index;
            q.options.forEach(option => {
                const optionEl = document.createElement('label');
                optionEl.className = 'question-option';
                optionEl.innerHTML = `
                    <input type="radio" name="question-${index}" value="${option}" class="hidden">
                    <span>${option}</span>
                `;
                optionEl.addEventListener('click', () => {
                    optionsEl.querySelectorAll('.question-option').forEach(o => o.classList.remove('selected'));
                    optionEl.classList.add('selected');
                });
                optionsEl.appendChild(optionEl);
            });
            questionEl.appendChild(optionsEl);
            container.appendChild(questionEl);
        });
    }

    function generateCourseContent() {
        const contentDiv = document.getElementById('course-content');
        
        // This version uses corrected paths for local images
        const staticContent = `
            <style>
                .content-section h4 { font-size: 1.5rem; font-weight: 600; margin-top: 1.5rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; }
                .content-section ul { list-style-type: disc; margin-left: 1.5rem; margin-top: 1rem; }
                .content-section li { margin-bottom: 0.5rem; }
                .image-container { display: flex; gap: 1rem; margin-top: 1rem; margin-bottom: 1rem; }
                .image-container img { width: 200px; height: 150px; object-fit: cover; border-radius: 0.5rem; }
            </style>
    
            <div class="content-section">
                <h4>Circle</h4>
                <ul>
                    <li>A circle is a perfectly round shape.</li>
                    <li>It's defined as all points that are the same distance from a central point.</li>
                    <li>It has no corners and one continuous curved edge.</li>
                </ul>
                <div class="image-container">
                    <img src="/assets/circle_diagram.png" alt="Diagram of a circle">
                    <img src="/assets/circle_real.png" alt="A real-world circle">
                </div>
    
                <h4>Square</h4>
                <ul>
                    <li>A square is a shape with four equal straight sides.</li>
                    <li>It has four corners, all of which are perfect right angles (90 degrees).</li>
                </ul>
                <div class="image-container">
                    <img src="/assets/square_diagram.png" alt="Diagram of a square">
                    <img src="/assets/square_real.png" alt="A real-world square">
                </div>
    
                <h4>Triangle</h4>
                <ul>
                    <li>A triangle is a shape with three straight sides and three corners (vertices).</li>
                    <li>The sum of its three angles always equals 180 degrees.</li>
                </ul>
                <div class="image-container">
                    <img src="/assets/triangle_diagram.png" alt="Diagram of a triangle">
                    <img src="/assets/triangle_real.png" alt="A real-world triangle">
                </div>
            </div>
        `;
    
        contentDiv.innerHTML = staticContent;
    }

    async function generateFinalAssessmentQuestions() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE_URL}/generate/assessment`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch questions from server.');
            
            const data = await response.json();
            const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
            finalAssessmentQuestions = parsed.questions;

        } catch (e) {
            console.error("Failed to get or parse questions from backend:", e);
            finalAssessmentQuestions = [];
        }
        
        if (finalAssessmentQuestions.length === 0) {
            finalAssessmentQuestions = [
                { question: "A samosa is shaped most like a...", options: ["Circle", "Square", "Triangle", "Rectangle"], answer: "Triangle" },
                { question: "If a shape has 4 equal sides and 4 right angles, what is it?", options: ["Rectangle", "Circle", "Triangle", "Square"], answer: "Square" },
                { question: "How many corners does a circle have?", options: ["0", "1", "2", "4"], answer: "0" }
            ];
        }
        renderAssessment('final-assessment-questions', finalAssessmentQuestions);
    }

    // --- Assessment Logic ---
    function calculateScore(containerId, questions) {
        let score = 0;
        const container = document.getElementById(containerId);
        const questionDivs = container.querySelectorAll('[data-question-index]');
        
        questionDivs.forEach((div, index) => {
            const selectedRadio = div.querySelector(`input[name="question-${index}"]:checked`);
            if (selectedRadio && questions[index] && selectedRadio.value === questions[index].answer) {
                score++;
            }
        });
        return score;
    }

    // --- Auth State and User Flow ---
    function checkAuthState() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                showPage('login-page');
                return;
            }

            const userPayloadString = localStorage.getItem('userPayload');
            if (!userPayloadString) {
                localStorage.removeItem('authToken');
                showPage('login-page');
                return;
            }
            
            const userPayload = JSON.parse(userPayloadString);
            handleUserFlow(userPayload);

        } catch (error) {
            console.error("Error during auth state check:", error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('userPayload');
            showPage('login-page');
        }
    }

    async function handleUserFlow(user) {
        currentUser = user;
        studentData = user; 
        if (user.role === 'admin') {
            await loadAdminDashboard();
        } else {
            if (studentData.preAssessmentScore === null) {
                renderAssessment('pre-assessment-questions', preAssessmentQuestions);
                showPage('pre-assessment-page');
            } else if (studentData.finalAssessmentScore === null) {
                generateCourseContent(); // Now a synchronous function
                showPage('content-page');
            } else {
                await loadStudentDashboard();
            }
        }
    }

    async function loadStudentDashboard() {
        document.getElementById('student-email-display').textContent = `Student: ${currentUser.email}`;
        
        const scores = [ studentData.preAssessmentScore || 0, studentData.finalAssessmentScore || 0 ];
        const maxScore = 5;

        const ctx = document.getElementById('student-chart').getContext('2d');
        if(studentChartInstance) studentChartInstance.destroy();
        studentChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Pre-Assessment', 'Final Assessment'],
                datasets: [{
                    label: 'Your Scores',
                    data: scores,
                    backgroundColor: ['#a5b4fc', '#6366f1'],
                    borderColor: ['#818cf8', '#4f46e5'],
                    borderWidth: 1
                }]
            },
            options: {
                scales: { y: { beginAtZero: true, max: maxScore, ticks: { stepSize: 1 } } },
                responsive: true,
                plugins: { legend: { display: false }, title: { display: true, text: 'Your Assessment Performance' } }
            }
        });
        showPage('student-dashboard-page');
    }

    async function loadAdminDashboard() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch admin data');
            const data = await response.json();
            
            document.getElementById('avg-pre-score').textContent = data.avgPre.toFixed(2) || 'N/A';
            document.getElementById('avg-post-score').textContent = data.avgPost.toFixed(2) || 'N/A';

            const scoreDistribution = data.scoreDistribution;
            const maxScore = 5;
            const labels = Array.from({length: maxScore + 1}, (_, i) => i);
            const chartData = labels.map(label => scoreDistribution[label] || 0);

            const ctx = document.getElementById('admin-chart').getContext('2d');
            if(adminChartInstance) adminChartInstance.destroy();
            adminChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '# of Students',
                        data: chartData,
                        backgroundColor: '#818cf8'
                    }]
                },
                options: {
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                    responsive: true,
                    plugins: { legend: { display: false }, title: { display: true, text: 'Distribution of Final Assessment Scores' } }
                }
            });
            showPage('admin-dashboard-page');
        } catch (error) {
            console.error(error);
            authError.textContent = 'Could not load admin data.';
            authError.classList.remove('hidden');
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        // Shapes Info Page Navigation
        document.getElementById('goto-shapes-info-btn')?.addEventListener('click', () => {
            showPage('shapes-info-page');
        });
        
        document.getElementById('back-to-content-from-shapes-btn')?.addEventListener('click', () => {
            showPage('content-page');
        });
        
        document.getElementById('logout-btn-shapes')?.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userPayload');
            showPage('login-page');
        });
        
        // Handle shape image upload and analysis
        document.getElementById('analyze-shape-btn')?.addEventListener('click', async () => {
            const fileInput = document.getElementById('shape-image');
            if (!fileInput.files || fileInput.files.length === 0) {
                alert('Please select an image first');
                return;
            }
            
            loadingSpinner.style.display = 'flex';
            
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            
            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch(`${API_BASE_URL}/shapes/analyze`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to analyze image: ${errorText}`);
                }
                
                const data = await response.json();
                document.getElementById('uploaded-image').src = data.imageUrl;
                document.getElementById('detected-shape-name').textContent = data.shape;
                document.getElementById('shape-properties').textContent = data.properties;
                document.getElementById('shape-result').classList.remove('hidden');
            } catch (error) {
                alert('Error analyzing image: ' + error.message);
                console.error(error);
            } finally {
                loadingSpinner.style.display = 'none';
            }
        });

        document.getElementById('login-btn').addEventListener('click', async () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            authError.classList.add('hidden');
            loadingSpinner.style.display = 'flex';
            try {
                const response = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Login failed');
                
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userPayload', JSON.stringify(data.user));
                await handleUserFlow(data.user);
            } catch (error) {
                authError.textContent = error.message;
                authError.classList.remove('hidden');
                loadingSpinner.style.display = 'none';
            }
        });

        document.getElementById('register-btn').addEventListener('click', async () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            authError.classList.add('hidden');
            loadingSpinner.style.display = 'flex';
            try {
                const response = await fetch(`${API_BASE_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Registration failed');

                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userPayload', JSON.stringify(data.user));
                await handleUserFlow(data.user);
            } catch (error) {
                authError.textContent = error.message;
                authError.classList.remove('hidden');
                loadingSpinner.style.display = 'none';
            }
        });

        const logoutBtns = document.querySelectorAll('#logout-btn-content, #logout-btn-student, #logout-btn-admin');
        logoutBtns.forEach(btn => btn.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userPayload');
            currentUser = null;
            studentData = null;
            showPage('login-page');
        }));

        document.getElementById('submit-pre-assessment-btn').addEventListener('click', async () => {
            loadingSpinner.style.display = 'flex';
            const score = calculateScore('pre-assessment-questions', preAssessmentQuestions);
            const token = localStorage.getItem('authToken');
            
            await fetch(`${API_BASE_URL}/scores/pre`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ score })
            });

            currentUser.preAssessmentScore = score;
            localStorage.setItem('userPayload', JSON.stringify(currentUser));
            await handleUserFlow(currentUser);
        });
        
        document.getElementById('submit-final-assessment-btn').addEventListener('click', async () => {
            loadingSpinner.style.display = 'flex';
            const score = calculateScore('final-assessment-questions', finalAssessmentQuestions);
            const token = localStorage.getItem('authToken');

            await fetch(`${API_BASE_URL}/scores/final`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ score })
            });

            currentUser.finalAssessmentScore = score;
            localStorage.setItem('userPayload', JSON.stringify(currentUser));
            await handleUserFlow(currentUser);
        });

        document.getElementById('goto-final-assessment-btn').addEventListener('click', async () => {
            loadingSpinner.style.display = 'flex';
            await generateFinalAssessmentQuestions();
            showPage('final-assessment-page');
        });
        document.getElementById('goto-student-dashboard-btn').addEventListener('click', () => {
            loadingSpinner.style.display = 'flex';
            loadStudentDashboard();
        });
        document.getElementById('back-to-content-btn').addEventListener('click', () => showPage('content-page'));
    }

    // --- Initialize App ---
    setupEventListeners();
    checkAuthState();
});
