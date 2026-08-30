import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecruitmentPage } from './RecruitmentPage';
import { recruitmentService } from '../../../services/recruitment.service';
import { useRecruitmentStore } from '../../../store/recruitmentStore';

vi.mock('../../../services/recruitment.service', () => ({
  recruitmentService: {
    getJobPostings: vi.fn(),
    createJobPosting: vi.fn(),
    updateJobPosting: vi.fn(),
    deleteJobPosting: vi.fn(),
    getCandidates: vi.fn(),
    createCandidate: vi.fn(),
    updateCandidateStage: vi.fn(),
    submitEvaluation: vi.fn(),
    getEvaluation: vi.fn(),
    previewOffer: vi.fn(),
    generateOffer: vi.fn(),
    getCandidateOffer: vi.fn(),
  },
}));

vi.mock('../../../services/employee.service', () => ({
  employeeService: {
    getEmployees: vi.fn().mockResolvedValue([]),
    createEmployee: vi.fn().mockResolvedValue({ id: 'emp-1' }),
  },
}));

vi.mock('../../../services/document.service', () => ({
  documentService: {
    getDocuments: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../store/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      user: {
        id: 'admin-1',
        name: 'Ravi kisan',
        email: 'ravi@acmecorp.com',
        role: 'HRAdmin',
        companyId: 'comp-1',
        permissions: ['*'],
      },
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../../../hooks/useOrgQuery', () => ({
  useDepartmentsQuery: vi.fn(() => ({
    data: [
      { id: 'dept-eng', name: 'Engineering' },
      { id: 'dept-sales', name: 'Sales' },
    ],
    isLoading: false,
  })),
  useDesignationsQuery: vi.fn(() => ({
    data: [
      { id: 'desig-swe', name: 'Software Engineer', band: 'L3' },
      { id: 'desig-lead', name: 'Lead Architect', band: 'L5' },
    ],
    isLoading: false,
  })),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const mockInitialRequisitions = [
  {
    id: 'req-1',
    title: 'Lead Architect',
    department: 'Engineering',
    openings: 2,
    status: 'Open',
    location: 'Bangalore',
    type: 'Full-Time',
    priority: 'High',
    minSalary: 2500000,
    maxSalary: 3500000,
    currency: 'INR',
  },
];

const mockInitialCandidates = [
  {
    id: 'cand-1',
    name: 'Jane Kumari',
    jobTitle: 'Lead Architect',
    stage: 'Applied',
    score: 88,
    resume: '',
    email: 'jane@acmecorp.com',
  },
];

describe('RecruitmentPage — Hiring Pipeline & Requisition Workflow Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (recruitmentService.getJobPostings as any).mockResolvedValue(mockInitialRequisitions);
    (recruitmentService.getCandidates as any).mockResolvedValue(mockInitialCandidates);
    (recruitmentService.createJobPosting as any).mockResolvedValue({ id: 'req-new', title: 'New Job' });
    (recruitmentService.createCandidate as any).mockResolvedValue({ id: 'cand-new', name: 'New Cand' });

    useRecruitmentStore.setState({
      requisitions: [
        {
          id: 'req-1',
          title: 'Lead Architect',
          dept: 'Engineering',
          openings: 2,
          status: 'Open',
          location: 'Bangalore',
          type: 'Full-Time',
          priority: 'High',
          minSalary: 2500000,
          maxSalary: 3500000,
          currency: 'INR',
        },
      ],
      candidates: [
        {
          id: 'cand-1',
          name: 'Jane Kumari',
          position: 'Lead Architect',
          status: 'Applied',
          score: 88,
          resume: '',
          email: 'jane@acmecorp.com',
        },
      ],
    });
  });

  it('1. Department typing synchronizes form state and submits typed department correctly', async () => {
    (recruitmentService.createJobPosting as any).mockResolvedValueOnce({
      id: 'req-2',
      title: 'DevOps Specialist',
      department: 'Infrastructure',
    });

    const mockToast = vi.fn();
    renderWithClient(<RecruitmentPage toast={mockToast} />);

    // Click Raise Requisition
    fireEvent.click(screen.getByRole('button', { name: /Raise Requisition/i }));

    // Fill Title
    const titleInput = screen.getByPlaceholderText(/e.g. Lead Backend Engineer/i);
    fireEvent.change(titleInput, { target: { value: 'DevOps Specialist' } });

    // Type Department directly
    const deptInput = screen.getByPlaceholderText(/Type or select department.../i);
    fireEvent.change(deptInput, { target: { value: 'Infrastructure' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Submit Requisition/i }));

    await waitFor(() => {
      expect(recruitmentService.createJobPosting).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'DevOps Specialist',
          department: 'Infrastructure',
        }),
      );
      expect(mockToast).toHaveBeenCalledWith('Job Requisition submitted successfully');
    });
  });

  it('2. Department dropdown selection stores matching departmentId', async () => {
    (recruitmentService.createJobPosting as any).mockResolvedValueOnce({
      id: 'req-3',
      title: 'Senior Frontend Dev',
      department: 'Engineering',
      departmentId: 'dept-eng',
    });

    const mockToast = vi.fn();
    renderWithClient(<RecruitmentPage toast={mockToast} />);

    fireEvent.click(screen.getByRole('button', { name: /Raise Requisition/i }));

    const titleInput = screen.getByPlaceholderText(/e.g. Lead Backend Engineer/i);
    fireEvent.change(titleInput, { target: { value: 'Senior Frontend Dev' } });

    const deptInput = screen.getByPlaceholderText(/Type or select department.../i);
    fireEvent.focus(deptInput);

    // Click 'Engineering' suggestion
    const engOption = screen.getByRole('button', { name: /Engineering/i });
    fireEvent.mouseDown(engOption);

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Submit Requisition/i }));

    await waitFor(() => {
      expect(recruitmentService.createJobPosting).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Senior Frontend Dev',
          department: 'Engineering',
          departmentId: 'dept-eng',
        }),
      );
    });
  });

  it('3. Designation selection stores correct designationId UUID', async () => {
    (recruitmentService.createJobPosting as any).mockResolvedValueOnce({
      id: 'req-4',
      title: 'Principal Engineer',
      department: 'Engineering',
      departmentId: 'dept-eng',
      designationId: 'desig-lead',
    });

    renderWithClient(<RecruitmentPage toast={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Raise Requisition/i }));

    fireEvent.change(screen.getByPlaceholderText(/e.g. Lead Backend Engineer/i), {
      target: { value: 'Principal Engineer' },
    });

    const deptInput = screen.getByPlaceholderText(/Type or select department.../i);
    fireEvent.focus(deptInput);
    fireEvent.mouseDown(screen.getByRole('button', { name: /Engineering/i }));

    const desigInput = screen.getByPlaceholderText(/Type or select designation.../i);
    fireEvent.focus(desigInput);
    fireEvent.mouseDown(screen.getByRole('button', { name: /Lead Architect/i }));

    fireEvent.click(screen.getByRole('button', { name: /Submit Requisition/i }));

    await waitFor(() => {
      expect(recruitmentService.createJobPosting).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Principal Engineer',
          department: 'Engineering',
          departmentId: 'dept-eng',
          designationId: 'desig-lead',
        }),
      );
    });
  });

  it('4. Candidate creation links to selected active requisition and passes real jobId', async () => {
    (recruitmentService.createCandidate as any).mockResolvedValueOnce({
      id: 'cand-101',
      name: 'Rohan Das',
      email: 'rohan@example.com',
      jobId: 'req-1',
      jobTitle: 'Lead Architect',
      stage: 'Applied',
    });

    const mockToast = vi.fn();
    renderWithClient(<RecruitmentPage toast={mockToast} />);

    // Click Add Candidate
    fireEvent.click(screen.getByRole('button', { name: /Add Candidate/i }));

    fireEvent.change(screen.getByPlaceholderText(/e.g. Rohan Das/i), {
      target: { value: 'Rohan Das' },
    });
    fireEvent.change(screen.getByPlaceholderText(/rohan@gmail.com/i), {
      target: { value: 'rohan@example.com' },
    });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Add to Pipeline/i }));

    await waitFor(() => {
      expect(recruitmentService.createCandidate).toHaveBeenCalledWith(
        'Rohan Das',
        'rohan@example.com',
        'req-1',
        'Lead Architect',
      );
      expect(mockToast).toHaveBeenCalledWith('Candidate added to pipeline');
    });
  });

  it('5. Add Candidate button is disabled or warns when 0 requisitions exist', async () => {
    (recruitmentService.getJobPostings as any).mockResolvedValue([]);
    (recruitmentService.getCandidates as any).mockResolvedValue([]);
    useRecruitmentStore.setState({
      requisitions: [],
      candidates: [],
    });

    renderWithClient(<RecruitmentPage toast={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Candidate/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Candidate/i }));

    expect(
      screen.getByText(/No active job requisitions found/i),
    ).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Add to Pipeline/i });
    expect(submitBtn).toBeDisabled();
  });

  it('6. Candidate card displays correct position title on Kanban board', async () => {
    renderWithClient(<RecruitmentPage toast={vi.fn()} />);

    expect(screen.getByText('Jane Kumari')).toBeInTheDocument();
    expect(screen.getAllByText('Lead Architect').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('88%')).toBeInTheDocument();
  });
});
