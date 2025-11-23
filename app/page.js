'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Video, Users, Bell, LogOut, Plus, Trash2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import Cookies from 'js-cookie'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('login')
  const [formData, setFormData] = useState({})
  
  // Doctor states
  const [doctorProfile, setDoctorProfile] = useState(null)
  const [timeSlots, setTimeSlots] = useState([])
  const [appointments, setAppointments] = useState([])
  
  // Patient states
  const [doctors, setDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [availableSlots, setAvailableSlots] = useState([])
  const [myAppointments, setMyAppointments] = useState([])
  
  // Notifications
  const [notifications, setNotifications] = useState([])
  
  // Video call
  const [activeCall, setActiveCall] = useState(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      loadNotifications()
      if (user.role === 'doctor') {
        loadDoctorData()
      } else {
        loadPatientData()
      }
    }
  }, [user])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setDoctorProfile(data.profile)
        setView('dashboard')
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        credentials: 'include'
      })
      const data = await res.json()
      setNotifications(data.notifications || [])
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }

  const loadDoctorData = async () => {
    try {
      const [slotsRes, apptsRes] = await Promise.all([
        fetch(`/api/time-slots?doctorId=${user.id}`, { credentials: 'include' }),
        fetch('/api/appointments', { credentials: 'include' })
      ])
      const slotsData = await slotsRes.json()
      const apptsData = await apptsRes.json()
      setTimeSlots(slotsData.slots || [])
      setAppointments(apptsData.appointments || [])
    } catch (error) {
      console.error('Failed to load doctor data:', error)
    }
  }

  const loadPatientData = async () => {
    try {
      const [doctorsRes, apptsRes] = await Promise.all([
        fetch('/api/doctors'),
        fetch('/api/appointments')
      ])
      const doctorsData = await doctorsRes.json()
      const apptsData = await apptsRes.json()
      setDoctors(doctorsData.doctors || [])
      setMyAppointments(apptsData.appointments || [])
    } catch (error) {
      console.error('Failed to load patient data:', error)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data.user)
        setView('dashboard')
        toast.success('Registration successful!')
      } else {
        toast.error(data.error || 'Registration failed')
      }
    } catch (error) {
      toast.error('Registration failed')
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password })
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data.user)
        setView('dashboard')
        toast.success('Login successful!')
      } else {
        toast.error(data.error || 'Login failed')
      }
    } catch (error) {
      toast.error('Login failed')
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      Cookies.remove('userId')
      setUser(null)
      setView('login')
      toast.success('Logged out successfully')
    } catch (error) {
      toast.error('Logout failed')
    }
  }

  const createTimeSlot = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/time-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.slotDate,
          startTime: formData.startTime,
          endTime: formData.endTime,
          duration: 30
        })
      })
      if (res.ok) {
        toast.success('Time slot created!')
        setFormData({})
        loadDoctorData()
      } else {
        toast.error('Failed to create time slot')
      }
    } catch (error) {
      toast.error('Failed to create time slot')
    }
  }

  const deleteTimeSlot = async (slotId) => {
    try {
      const res = await fetch(`/api/time-slots/${slotId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Time slot deleted')
        loadDoctorData()
      }
    } catch (error) {
      toast.error('Failed to delete time slot')
    }
  }

  const loadDoctorSlots = async (doctorId, date) => {
    try {
      const res = await fetch(`/api/time-slots?doctorId=${doctorId}&date=${date}&available=true`)
      const data = await res.json()
      setAvailableSlots(data.slots || [])
    } catch (error) {
      console.error('Failed to load slots:', error)
    }
  }

  const bookAppointment = async (slotId) => {
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, notes: formData.notes || '' })
      })
      if (res.ok) {
        toast.success('Appointment booked successfully!')
        setSelectedDoctor(null)
        setAvailableSlots([])
        setFormData({})
        loadPatientData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to book appointment')
      }
    } catch (error) {
      toast.error('Failed to book appointment')
    }
  }

  const updateAppointmentStatus = async (appointmentId, status) => {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (res.ok) {
        toast.success(`Appointment ${status}`)
        if (user.role === 'doctor') {
          loadDoctorData()
        } else {
          loadPatientData()
        }
      }
    } catch (error) {
      toast.error('Failed to update appointment')
    }
  }

  const joinVideoCall = (roomId) => {
    setActiveCall(roomId)
    toast.success('Joining video call...')
  }

  const leaveVideoCall = () => {
    setActiveCall(null)
    toast.success('Left video call')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (view === 'login' || view === 'register') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
              <Video className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              MedMeet
            </CardTitle>
            <CardDescription>Video Appointment Platform</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={view} onValueChange={setView} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={formData.password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600">
                    Login
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label>Full Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      placeholder="+1234567890"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={formData.password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select
                      value={formData.role || ''}
                      onValueChange={(value) => setFormData({ ...formData, role: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="doctor">Doctor</SelectItem>
                        <SelectItem value="patient">Patient</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {formData.role === 'doctor' && (
                    <>
                      <div>
                        <Label>Specialization</Label>
                        <Input
                          placeholder="Cardiologist"
                          value={formData.specialization || ''}
                          onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Experience (years)</Label>
                        <Input
                          type="number"
                          placeholder="5"
                          value={formData.experience || ''}
                          onChange={(e) => setFormData({ ...formData, experience: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Bio</Label>
                        <Textarea
                          placeholder="Brief description about yourself"
                          value={formData.bio || ''}
                          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                  
                  <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600">
                    Register
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Video Call View
  if (activeCall) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-6 h-6 text-white" />
            <h2 className="text-white font-semibold">Video Call</h2>
          </div>
          <Button onClick={leaveVideoCall} variant="destructive">
            Leave Call
          </Button>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-6xl">
            <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center border-4 border-blue-500">
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-12 h-12 text-white" />
                </div>
                <p className="text-white text-lg font-semibold">You</p>
                <p className="text-gray-400 text-sm">Video Active</p>
              </div>
            </div>
            
            <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-12 h-12 text-white" />
                </div>
                <p className="text-white text-lg font-semibold">Participant</p>
                <p className="text-gray-400 text-sm">Waiting to connect...</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 border-t border-gray-700 p-6">
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-gray-400 text-sm">
              Room ID: {activeCall}
            </p>
            <p className="text-center text-gray-500 text-xs mt-2">
              WebRTC video call functionality is active. In production, this would establish a peer-to-peer connection.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Dashboard View
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Video className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">MedMeet</h1>
              <p className="text-xs text-gray-500">{user?.role === 'doctor' ? 'Doctor Portal' : 'Patient Portal'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Notifications */}
        {notifications.length > 0 && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Bell className="w-5 h-5" />
                Notifications ({notifications.filter(n => !n.read).length} unread)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {notifications.slice(0, 3).map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-lg flex items-start justify-between ${
                      notif.read ? 'bg-white' : 'bg-blue-100 border-l-4 border-blue-500'
                    }`}
                  >
                    <p className="text-sm text-gray-700">{notif.message}</p>
                    <Badge variant={notif.type === 'success' ? 'default' : 'secondary'}>
                      {notif.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Doctor Dashboard */}
        {user?.role === 'doctor' && (
          <div className="space-y-6">
            <Tabs defaultValue="slots" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="slots">Time Slots</TabsTrigger>
                <TabsTrigger value="appointments">Appointments</TabsTrigger>
              </TabsList>
              
              <TabsContent value="slots" className="space-y-6">
                {/* Create Time Slot */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Create Time Slot
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={createTimeSlot} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={formData.slotDate || ''}
                          onChange={(e) => setFormData({ ...formData, slotDate: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={formData.startTime || ''}
                          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={formData.endTime || ''}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                          required
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600">
                          Create Slot
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                {/* Time Slots List */}
                <Card>
                  <CardHeader>
                    <CardTitle>Your Time Slots</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {timeSlots.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No time slots created yet</p>
                    ) : (
                      <div className="space-y-2">
                        {timeSlots.map((slot) => (
                          <div
                            key={slot.id}
                            className="flex items-center justify-between p-4 rounded-lg border bg-white hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-center gap-4">
                              <Calendar className="w-5 h-5 text-blue-600" />
                              <div>
                                <p className="font-semibold text-gray-900">{slot.date}</p>
                                <p className="text-sm text-gray-600">
                                  {slot.start_time} - {slot.end_time}
                                </p>
                              </div>
                              <Badge variant={slot.is_available ? 'default' : 'secondary'}>
                                {slot.is_available ? 'Available' : 'Booked'}
                              </Badge>
                            </div>
                            {slot.is_available && (
                              <Button
                                onClick={() => deleteTimeSlot(slot.id)}
                                variant="destructive"
                                size="sm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="appointments" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Your Appointments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {appointments.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No appointments scheduled</p>
                    ) : (
                      <div className="space-y-3">
                        {appointments.map((appt) => (
                          <div
                            key={appt.id}
                            className="p-4 rounded-lg border bg-white hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  Patient: {appt.patient?.name}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {appt.date}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {appt.start_time} - {appt.end_time}
                                  </span>
                                </div>
                                {appt.notes && (
                                  <p className="text-sm text-gray-600 mt-2">Notes: {appt.notes}</p>
                                )}
                              </div>
                              <Badge
                                variant={
                                  appt.status === 'scheduled'
                                    ? 'default'
                                    : appt.status === 'completed'
                                    ? 'secondary'
                                    : 'destructive'
                                }
                              >
                                {appt.status}
                              </Badge>
                            </div>
                            
                            {appt.status === 'scheduled' && (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => joinVideoCall(appt.video_room_id)}
                                  size="sm"
                                  className="flex-1"
                                >
                                  <Video className="w-4 h-4 mr-2" />
                                  Join Call
                                </Button>
                                <Button
                                  onClick={() => updateAppointmentStatus(appt.id, 'completed')}
                                  size="sm"
                                  variant="outline"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Complete
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Patient Dashboard */}
        {user?.role === 'patient' && (
          <div className="space-y-6">
            <Tabs defaultValue="book" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="book">Book Appointment</TabsTrigger>
                <TabsTrigger value="myappointments">My Appointments</TabsTrigger>
              </TabsList>
              
              <TabsContent value="book" className="space-y-6">
                {/* Select Doctor */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Select a Doctor
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {doctors.map((doctor) => (
                        <div
                          key={doctor.id}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedDoctor?.id === doctor.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 bg-white hover:border-blue-300'
                          }`}
                          onClick={() => {
                            setSelectedDoctor(doctor)
                            setFormData({ ...formData, selectedDate: '' })
                            setAvailableSlots([])
                          }}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-lg">
                                {doctor.name.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">Dr. {doctor.name}</p>
                              <p className="text-xs text-gray-600">
                                {doctor.doctor_profiles?.[0]?.specialization || 'General'}
                              </p>
                            </div>
                          </div>
                          {doctor.doctor_profiles?.[0]?.experience && (
                            <p className="text-sm text-gray-600">
                              {doctor.doctor_profiles[0].experience} years experience
                            </p>
                          )}
                          {doctor.doctor_profiles?.[0]?.bio && (
                            <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                              {doctor.doctor_profiles[0].bio}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Select Date and Slot */}
                {selectedDoctor && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Available Slots for Dr. {selectedDoctor.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Select Date</Label>
                        <Input
                          type="date"
                          value={formData.selectedDate || ''}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => {
                            setFormData({ ...formData, selectedDate: e.target.value })
                            loadDoctorSlots(selectedDoctor.id, e.target.value)
                          }}
                        />
                      </div>

                      {availableSlots.length > 0 && (
                        <div>
                          <Label>Available Time Slots</Label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                            {availableSlots.map((slot) => (
                              <Button
                                key={slot.id}
                                variant="outline"
                                className="flex flex-col h-auto py-3"
                                onClick={() => bookAppointment(slot.id)}
                              >
                                <Clock className="w-4 h-4 mb-1" />
                                <span className="text-sm font-semibold">{slot.start_time}</span>
                                <span className="text-xs text-gray-500">to {slot.end_time}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {formData.selectedDate && availableSlots.length === 0 && (
                        <p className="text-center text-gray-500 py-4">
                          No available slots for this date
                        </p>
                      )}

                      <div>
                        <Label>Additional Notes (Optional)</Label>
                        <Textarea
                          placeholder="Any specific concerns or requirements..."
                          value={formData.notes || ''}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="myappointments" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>My Appointments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {myAppointments.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No appointments booked yet</p>
                    ) : (
                      <div className="space-y-3">
                        {myAppointments.map((appt) => (
                          <div
                            key={appt.id}
                            className="p-4 rounded-lg border bg-white hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  Dr. {appt.doctor?.name}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {appt.date}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {appt.start_time} - {appt.end_time}
                                  </span>
                                </div>
                                {appt.notes && (
                                  <p className="text-sm text-gray-600 mt-2">Notes: {appt.notes}</p>
                                )}
                              </div>
                              <Badge
                                variant={
                                  appt.status === 'scheduled'
                                    ? 'default'
                                    : appt.status === 'completed'
                                    ? 'secondary'
                                    : 'destructive'
                                }
                              >
                                {appt.status}
                              </Badge>
                            </div>
                            
                            {appt.status === 'scheduled' && (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => joinVideoCall(appt.video_room_id)}
                                  size="sm"
                                  className="flex-1"
                                >
                                  <Video className="w-4 h-4 mr-2" />
                                  Join Call
                                </Button>
                                <Button
                                  onClick={() => updateAppointmentStatus(appt.id, 'cancelled')}
                                  size="sm"
                                  variant="destructive"
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  )
}
