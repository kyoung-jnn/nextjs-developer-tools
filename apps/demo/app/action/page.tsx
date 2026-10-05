import { revalidatePath } from 'next/cache';

async function submit(formData: FormData) {
  'use server';
  console.log('Server action submitted:', String(formData.get('message') ?? ''));
  revalidatePath('/action');
}
export default function Action() {
  return (
    <>
      <h1>Server action</h1>
      <form action={submit}>
        <label htmlFor="message">Message </label>
        <input id="message" name="message" defaultValue="Hello 👋" />
        <button type="submit">Submit action</button>
      </form>
    </>
  );
}
