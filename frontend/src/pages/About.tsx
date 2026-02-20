import React from 'react';
import { motion } from 'framer-motion';
import { Target, Eye, Heart, Users, Lightbulb, Zap } from 'lucide-react';

const stats = [
  { value: '50K+', label: 'Active Students' },
  { value: '5K+', label: 'Expert Tutors' },
  { value: '100+', label: 'Subjects' },
  { value: '150+', label: 'Countries' },
];

const values = [
  {
    icon: Lightbulb,
    title: 'Innovation',
    description: 'We continuously innovate to provide the best learning experience through technology.',
  },
  {
    icon: Heart,
    title: 'Passion',
    description: 'We\'re passionate about education and believe everyone deserves access to quality tutoring.',
  },
  {
    icon: Users,
    title: 'Community',
    description: 'We foster a global community of learners and educators supporting each other.',
  },
  {
    icon: Zap,
    title: 'Excellence',
    description: 'We strive for excellence in everything we do, from tutor quality to platform experience.',
  },
];

const team = [
  {
    name: 'Saarunya Murali',
    role: 'Director',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Saarunya&backgroundColor=b6e3f4',
    bio: 'As the Director, Saarunya Murali brings a wealth of expertise in education, training, and people management. With over 6 years of industrial experience, she has guided numerous student projects as a skilled HR researcher, subject matter expert, and analyst. A former educator and public speaker, she has a proven track record of enhancing personality development and has conducted sessions on The Art of Parenting, focusing on holistic child development and parental growth. Her leadership extends to overseeing office management, driving operational excellence and strategic growth.',
    featured: true,
  },
];

const About: React.FC = () => {
  return (
    <div className="min-h-screen pt-20">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">About Zeal Catalyst</h1>
            <p className="text-xl text-white/80">
              We're on a mission to democratize education by connecting learners with
              expert tutors from around the world.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">{stat.value}</div>
                <div className="text-gray-600">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="card p-8"
            >
              <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center mb-6">
                <Target className="w-7 h-7 text-primary-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h3>
              <p className="text-gray-600 leading-relaxed">
                Our mission is to bridge the gap, connecting learners from rural places to global cities,
                and empowering them with expert guidance. We believe quality education shouldn't be limited
                by location or background - it should be accessible to all in a cost effective manner.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="card p-8"
            >
              <div className="w-14 h-14 bg-secondary-100 rounded-xl flex items-center justify-center mb-6">
                <Eye className="w-7 h-7 text-secondary-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Our Vision</h3>
              <p className="text-gray-600 leading-relaxed">
                We envision a global learning community where knowledge flows freely across borders,
                fostering collaboration, innovation, and understanding. A community where learners,
                educators, and experts from diverse backgrounds come together to share insights, ideas,
                and experiences, driving progress and positive change worldwide.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="section-title mb-6">Our Story</h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Zeal Catalyst was founded in 2020 by a team of educators and technologists
                  who saw firsthand the transformative power of one-on-one tutoring, but also
                  recognized the barriers that prevented many students from accessing it.
                </p>
                <p>
                  What started as a small platform connecting local tutors with students has
                  grown into a global community of over 5,000 tutors teaching 50,000+ students
                  across 150 countries.
                </p>
                <p>
                  Our commitment to quality means every tutor on our platform is verified,
                  and we continuously invest in technology that makes learning more engaging
                  and effective.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <img
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                alt="Our team"
                className="rounded-2xl shadow-xl"
              />
              <div className="absolute -bottom-6 -right-6 w-full h-full bg-gradient-to-br from-primary-200 to-secondary-200 rounded-2xl -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="section-title mb-4">Our Values</h2>
            <p className="section-subtitle mx-auto">
              The principles that guide everything we do
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="card p-6 text-center"
              >
                <div className="w-14 h-14 mx-auto mb-4 bg-primary-100 rounded-xl flex items-center justify-center">
                  <value.icon className="w-7 h-7 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-gray-600 text-sm">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="section-title mb-4">Meet Our Team</h2>
            <p className="section-subtitle mx-auto">
              The passionate people behind Zeal Catalyst
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            {team.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="card p-8 md:p-12"
              >
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                  <div className="flex-shrink-0">
                    <div className="w-40 h-40 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 p-1">
                      <img
                        src={member.image}
                        alt={member.name}
                        className="w-full h-full rounded-xl bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-2xl font-bold text-gray-900">{member.name}</h3>
                    <p className="text-primary-600 font-semibold mb-4">{member.role}</p>
                    <p className="text-gray-600 leading-relaxed">{member.bio}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
