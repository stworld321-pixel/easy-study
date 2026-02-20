import React from 'react';
import Hero from '../components/home/Hero';
import Features from '../components/home/Features';
import ExpertVideo from '../components/home/ExpertVideo';
import Subjects from '../components/home/Subjects';
import HowItWorksPreview from '../components/home/HowItWorksPreview';
import Testimonials from '../components/home/Testimonials';
import CTA from '../components/home/CTA';

const Home: React.FC = () => {
  return (
    <>
      <Hero />
      <Features />
      <ExpertVideo />
      <Subjects />
      <HowItWorksPreview />
      <Testimonials />
      <CTA />
    </>
  );
};

export default Home;
