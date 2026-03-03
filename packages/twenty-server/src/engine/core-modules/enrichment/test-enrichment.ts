import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { PeopleEnrichmentService } from './services/people-enrichment.service';

async function testEnrichment() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const peopleEnrichmentService = app.get(PeopleEnrichmentService);

  // Replace with your actual workspace ID
  const workspaceId = '20202020-1c25-4d02-bf25-6aeccf7ea419';

  console.log('🔍 Finding people to enrich...');
  const peopleToEnrich = await peopleEnrichmentService.findPeopleToEnrich(
    workspaceId,
    5, // Test with just 5 people
  );

  console.log(`Found ${peopleToEnrich.length} people to enrich:`,
    peopleToEnrich.map(p => ({
      id: p.id,
      name: p.name,
      linkedinUrl: p.linkedinLink?.primaryLinkUrl
    }))
  );

  if (peopleToEnrich.length > 0) {
    console.log('\n📝 Creating tracking records...');
    const trackingRecords = await peopleEnrichmentService.createEnrichmentTracking(
      workspaceId,
      peopleToEnrich.map(p => p.id),
    );

    console.log(`Created ${trackingRecords.length} tracking records`);

    console.log('\n🚀 Starting enrichment...');
    await peopleEnrichmentService.enrichPeople(workspaceId, trackingRecords);

    console.log('✅ Enrichment started! Check tracking records in database.');

    console.log('\n📊 Enrichment stats:');
    const stats = await peopleEnrichmentService.getEnrichmentStats(workspaceId);
    console.log(stats);
  }

  await app.close();
}

testEnrichment().catch(console.error);
