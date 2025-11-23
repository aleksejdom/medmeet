import bcrypt from 'bcryptjs'
import { supabase } from './supabase'

export async function hashPassword(password) {
  return await bcrypt.hash(password, 10)
}

export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash)
}

export async function createUser(email, password, name, role, phone) {
  const passwordHash = await hashPassword(password)
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const { data, error } = await supabase
    .from('users')
    .insert([{
      id: userId,
      email,
      password_hash: passwordHash,
      name,
      role,
      phone,
      created_at: new Date().toISOString()
    }])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function findUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function findUserById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  return data
}
