import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Seeds the account and school shown in the Figma designs so the app has
 * something real to render on first run.
 */
async function main() {
  const school = await prisma.school.upsert({
    where: { id: 'school_dps_bokaro' },
    update: {},
    create: {
      id: 'school_dps_bokaro',
      name: 'Delhi Public School',
      city: 'Bokaro Steel City',
    },
  });

  const passwordHash = await bcrypt.hash('vedaai123', 10);

  const teacher = await prisma.user.upsert({
    where: { email: 'madhur@vedaai.test' },
    update: { schoolId: school.id },
    create: {
      email: 'madhur@vedaai.test',
      firstName: 'Madhur',
      lastName: 'Rastogi',
      passwordHash,
      role: 'TEACHER',
      schoolId: school.id,
    },
  });

  await prisma.assessment.upsert({
    where: { id: 'assessment_demo' },
    update: {},
    create: {
      id: 'assessment_demo',
      title: 'Class 10 Maths — Unit Test',
      subject: 'Mathematics',
      grade: 'Class 10',
      status: 'DRAFT',
      teacherId: teacher.id,
      schoolId: school.id,
    },
  });

  console.log('Seeded:');
  console.log(`  school     ${school.name}, ${school.city}`);
  console.log(`  teacher    ${teacher.email}  (password: vedaai123)`);
  console.log('  assessment Class 10 Maths — Unit Test');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
