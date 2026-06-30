import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { KpiService } from './kpi.service';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';

@Controller('kpi')
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  // Product types
  @Get('product-types')
  getProductTypes() {
    return this.kpiService.findAllProductTypes();
  }

  @Post('product-types')
  @UsePipes(new ValidationPipe())
  createProductType(@Body() dto: CreateProductTypeDto) {
    return this.kpiService.createProductType(dto);
  }

  @Patch('product-types/:id')
  updateProductType(@Param('id') id: string, @Body() dto: UpdateProductTypeDto) {
    return this.kpiService.updateProductType(+id, dto);
  }

  @Delete('product-types/:id')
  deleteProductType(@Param('id') id: string) {
    return this.kpiService.deleteProductType(+id);
  }

  // Monthly ranking
  @Get('ranking')
  getMonthlyRanking(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    return this.kpiService.getMonthlyRanking(y, m);
  }

  @Post('summarize')
  async triggerSummarize(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    return this.kpiService.summarizeAll(y, m);
  }

  @Get('my-points')
  getMyPoints(@Req() req: any) {
    const userId = Number(req.user?.id || req.user?.sub || 0);
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    return this.kpiService.getEmployeeMonthlyPoints(userId, year, month);
  }
}
