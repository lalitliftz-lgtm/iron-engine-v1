import LegalLayout from '../../components/LegalLayout';

export default function About() {
  return (
    <LegalLayout title="About LalitLifts">
      <p>LalitLifts was built on a simple philosophy: science-based programming should be accessible, automated, and affordable.</p>
      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">The Iron Engine</h2>
      <p>Iron Engine is an automated powerlifting programming platform designed to deliver personalized, evidence-informed training programs based on each athlete’s profile, goals, and training data.</p>
      <p className="mt-4">The engine takes your 1RMs, identifies your weak points, factors in your life stress, and generates a training block using established loading principles and volume management. It applies a codified coaching framework directly to your profile to automate the diagnostic and prescription phases of programming.</p>
      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Our Mission</h2>
      <p>By automating program design, we provide you with a dynamic training plan at a fraction of the cost of traditional 1-on-1 coaching, allowing you to focus on what matters: lifting heavy and recovering well.</p>
      <p className="mt-8">Built by lifters, for lifters.</p>
    </LegalLayout>
  );
}
