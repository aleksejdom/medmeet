import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

export async function sendEmail({ to, subject, html }) {
  try {
    const info = await transporter.sendMail({
      from: `"Video Appointments" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    })
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Email error:', error)
    return { success: false, error: error.message }
  }
}

export function getAppointmentConfirmationEmail(appointment, doctor, patient) {
  const appointmentDate = new Date(appointment.date)
  return {
    subject: 'Appointment Confirmation',
    html: `
      <h2>Your appointment has been confirmed!</h2>
      <p><strong>Doctor:</strong> ${doctor.name}</p>
      <p><strong>Patient:</strong> ${patient.name}</p>
      <p><strong>Date:</strong> ${appointmentDate.toLocaleDateString()}</p>
      <p><strong>Time:</strong> ${appointment.start_time} - ${appointment.end_time}</p>
      <p>You will receive a reminder before your appointment starts.</p>
    `
  }
}

export function getAppointmentReminderEmail(appointment, doctor, patient, role) {
  return {
    subject: 'Appointment Reminder - Starting Soon',
    html: `
      <h2>Your appointment is starting in 15 minutes!</h2>
      <p><strong>${role === 'doctor' ? 'Patient' : 'Doctor'}:</strong> ${role === 'doctor' ? patient.name : doctor.name}</p>
      <p><strong>Time:</strong> ${appointment.start_time}</p>
      <p>Please log in to join the video call.</p>
    `
  }
}
