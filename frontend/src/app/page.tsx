import React from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import WorkflowSection from '@/components/WorkflowSection';
import ValueSection from '@/components/ValueSection';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <WorkflowSection />
        <ValueSection />
      </main>
      <Footer />
    </>
  );
}
