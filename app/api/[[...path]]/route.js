import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { createUser, findUserByEmail, verifyPassword, findUserById } from '../../../lib/auth'
import { sendEmail, getAppointmentConfirmationEmail } from '../../../lib/email'
import Cookies from 'js-cookie'

// Helper to get user from cookie
function getUserFromRequest(request) {
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map(c => {
      const [key, ...v] = c.split('=')
      return [key, v.join('=')]
    })
  )
  return cookies.userId ? { userId: cookies.userId } : null
}

// Auth Routes
export async function POST(request) {
  const url = new URL(request.url)
  const path = url.pathname

  try {
    // Register
    if (path === '/api/auth/register') {
      const { email, password, name, role, phone, specialization, bio, experience } = await request.json()
      
      // Check if user exists
      const existingUser = await findUserByEmail(email)
      if (existingUser) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
      }
      
      // Create user
      const user = await createUser(email, password, name, role, phone)
      
      // If doctor, create profile
      if (role === 'doctor') {
        const profileId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        await supabase.from('doctor_profiles').insert([{
          id: profileId,
          user_id: user.id,
          specialization: specialization || '',
          bio: bio || '',
          experience: experience || 0
        }])
      }
      
      const response = NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
      response.cookies.set('userId', user.id, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 })
      return response
    }

    // Login
    if (path === '/api/auth/login') {
      const { email, password } = await request.json()
      
      const user = await findUserByEmail(email)
      if (!user) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }
      
      const isValid = await verifyPassword(password, user.password_hash)
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }
      
      const response = NextResponse.json({ 
        success: true, 
        user: { id: user.id, email: user.email, name: user.name, role: user.role } 
      })
      response.cookies.set('userId', user.id, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 })
      return response
    }

    // Logout
    if (path === '/api/auth/logout') {
      const response = NextResponse.json({ success: true })
      response.cookies.delete('userId')
      return response
    }

    // Create time slot
    if (path === '/api/time-slots') {
      const auth = getUserFromRequest(request)
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { date, startTime, endTime, duration } = await request.json()
      const slotId = `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const { data, error } = await supabase.from('time_slots').insert([{
        id: slotId,
        doctor_id: auth.userId,
        date,
        start_time: startTime,
        end_time: endTime,
        duration: duration || 30,
        is_available: true,
        created_at: new Date().toISOString()
      }]).select().single()
      
      if (error) throw error
      return NextResponse.json({ success: true, slot: data })
    }

    // Book appointment
    if (path === '/api/appointments') {
      const auth = getUserFromRequest(request)
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { slotId, notes } = await request.json()
      
      // Get slot
      const { data: slot, error: slotError } = await supabase
        .from('time_slots')
        .select('*')
        .eq('id', slotId)
        .single()
      
      if (slotError || !slot) {
        return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
      }
      
      if (!slot.is_available) {
        return NextResponse.json({ error: 'Slot not available' }, { status: 400 })
      }
      
      // Create appointment
      const appointmentId = `appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const videoRoomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const { data: appointment, error: apptError } = await supabase
        .from('appointments')
        .insert([{
          id: appointmentId,
          doctor_id: slot.doctor_id,
          patient_id: auth.userId,
          time_slot_id: slotId,
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          status: 'scheduled',
          notes: notes || '',
          video_room_id: videoRoomId,
          created_at: new Date().toISOString()
        }])
        .select()
        .single()
      
      if (apptError) throw apptError
      
      // Mark slot as unavailable
      await supabase
        .from('time_slots')
        .update({ is_available: false })
        .eq('id', slotId)
      
      // Get doctor and patient info
      const { data: doctor } = await supabase.from('users').select('*').eq('id', slot.doctor_id).single()
      const { data: patient } = await supabase.from('users').select('*').eq('id', auth.userId).single()
      
      // Send confirmation emails
      if (doctor && patient) {
        const emailContent = getAppointmentConfirmationEmail(appointment, doctor, patient)
        await sendEmail({ to: doctor.email, ...emailContent })
        await sendEmail({ to: patient.email, ...emailContent })
      }
      
      // Create notifications
      const doctorNotifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const patientNotifId = `notif_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`
      
      await supabase.from('notifications').insert([
        {
          id: doctorNotifId,
          user_id: slot.doctor_id,
          message: `New appointment booked with ${patient.name} on ${slot.date} at ${slot.start_time}`,
          type: 'success',
          created_at: new Date().toISOString()
        },
        {
          id: patientNotifId,
          user_id: auth.userId,
          message: `Appointment confirmed with Dr. ${doctor.name} on ${slot.date} at ${slot.start_time}`,
          type: 'success',
          created_at: new Date().toISOString()
        }
      ])
      
      return NextResponse.json({ success: true, appointment })
    }

    // Update doctor profile
    if (path === '/api/doctor/profile') {
      const auth = getUserFromRequest(request)
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { specialization, bio, experience } = await request.json()
      
      const { data, error } = await supabase
        .from('doctor_profiles')
        .update({ specialization, bio, experience })
        .eq('user_id', auth.userId)
        .select()
        .single()
      
      if (error) throw error
      return NextResponse.json({ success: true, profile: data })
    }

    // Update appointment status
    if (path.match(/\/api\/appointments\/.*\/status/)) {
      const auth = getUserFromRequest(request)
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const appointmentId = path.split('/')[3]
      const { status } = await request.json()
      
      const { data, error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId)
        .select()
        .single()
      
      if (error) throw error
      return NextResponse.json({ success: true, appointment: data })
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request) {
  const url = new URL(request.url)
  const path = url.pathname

  try {
    // Get current user
    if (path === '/api/auth/me') {
      const auth = getUserFromRequest(request)
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      const user = await findUserById(auth.userId)
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      let profile = null
      if (user.role === 'doctor') {
        const { data } = await supabase
          .from('doctor_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()
        profile = data
      }
      
      return NextResponse.json({ 
        user: { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone },
        profile
      })
    }

    // Get all doctors
    if (path === '/api/doctors') {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          email,
          phone,
          doctor_profiles (
            specialization,
            bio,
            experience
          )
        `)
        .eq('role', 'doctor')
      
      if (error) throw error
      return NextResponse.json({ doctors: data || [] })
    }

    // Get time slots
    if (path === '/api/time-slots') {
      const doctorId = url.searchParams.get('doctorId')
      const date = url.searchParams.get('date')
      const available = url.searchParams.get('available')
      
      let query = supabase.from('time_slots').select('*')
      
      if (doctorId) query = query.eq('doctor_id', doctorId)
      if (date) query = query.eq('date', date)
      if (available === 'true') query = query.eq('is_available', true)
      
      query = query.order('date', { ascending: true }).order('start_time', { ascending: true })
      
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ slots: data || [] })
    }

    // Get appointments
    if (path === '/api/appointments') {
      const auth = getUserFromRequest(request)
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const user = await findUserById(auth.userId)
      
      let query = supabase
        .from('appointments')
        .select(`
          *,
          doctor:doctor_id (id, name, email),
          patient:patient_id (id, name, email)
        `)
      
      if (user.role === 'doctor') {
        query = query.eq('doctor_id', auth.userId)
      } else {
        query = query.eq('patient_id', auth.userId)
      }
      
      query = query.order('date', { ascending: true }).order('start_time', { ascending: true })
      
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ appointments: data || [] })
    }

    // Get notifications
    if (path === '/api/notifications') {
      const auth = getUserFromRequest(request)
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return NextResponse.json({ notifications: data || [] })
    }

    return NextResponse.json({ message: 'Video Appointments API' })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  const url = new URL(request.url)
  const path = url.pathname

  try {
    // Delete time slot
    if (path.match(/\/api\/time-slots\/.+/)) {
      const auth = getUserFromRequest(request)
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const slotId = path.split('/').pop()
      
      const { error } = await supabase
        .from('time_slots')
        .delete()
        .eq('id', slotId)
        .eq('doctor_id', auth.userId)
      
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  const url = new URL(request.url)
  const path = url.pathname

  try {
    // Mark notification as read
    if (path.match(/\/api\/notifications\/.+/)) {
      const auth = getUserFromRequest(request)
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const notifId = path.split('/').pop()
      
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notifId)
        .eq('user_id', auth.userId)
      
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
