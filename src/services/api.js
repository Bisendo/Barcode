import axios from 'axios';

const API_URL = 'http://localhost:8080/api';

axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-access-token'] = token;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location = '/login';
    }
    return Promise.reject(error);
  }
);

const authService = {
  login: (email, password) => axios.post(`${API_URL}/auth/signin`, { email, password }),
  register: (userData) => axios.post(`${API_URL}/auth/signup`, userData),
  verifyToken: () => axios.get(`${API_URL}/auth/verify`)
};

const paymentService = {
  createPayment: (paymentData) => axios.post(`${API_URL}/payments`, paymentData),
  getAllPayments: () => axios.get(`${API_URL}/payments`),
  getPaymentsByStudent: (studentId) => axios.get(`${API_URL}/payments/student/${studentId}`),
  getPaymentById: (id) => axios.get(`${API_URL}/payments/${id}`),
  generateReport: (params) => axios.get(`${API_URL}/payments/report`, { params })
};

const studentService = {
  getAllStudents: () => axios.get(`${API_URL}/students`),
  getStudentById: (id) => axios.get(`${API_URL}/students/${id}`),
  createStudent: (studentData) => axios.post(`${API_URL}/students`, studentData),
  updateStudent: (id, studentData) => axios.put(`${API_URL}/students/${id}`, studentData)
};

export { authService, paymentService, studentService };