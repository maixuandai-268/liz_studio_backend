import { Controller, Get, Post, Patch, Delete, Param, Body, UsePipes, ValidationPipe } from '@nestjs/common';
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
}
